import { Injectable } from '@angular/core'
import { Events } from 'ionic-angular'

import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http'
import { map, timeout } from 'rxjs/operators'
import { Observable } from 'rxjs/Observable'
import { BehaviorSubject } from 'rxjs/BehaviorSubject'
import { Subscription } from 'rxjs/Subscription'
import 'rxjs/add/operator/switchMap'

// Libs terceros
import * as _ from 'lodash'
import Raven from 'raven-js'

// AngularFire - Firebase
import { AngularFirestore, AngularFirestoreDocument, AngularFirestoreCollection } from 'angularfire2/firestore'
import * as firebase from 'firebase'

// Models
import { Producto } from './models/producto'
import { CarItem } from '../carrito/models/carItem'

// Providers
import { ConfigProvider as cg } from '../config/config'
import { AuthProvider } from '../auth/auth'

@Injectable()
export class ProductosProvider {

  public productos: Producto[]
  public productosBogota: Producto[]
  public sku$: BehaviorSubject<string | null>
  public skuBog$: BehaviorSubject<string | null>

  constructor (
    private angularFirestoreDB: AngularFirestore,
    private evts: Events,
    private http: HttpClient,
    private authServ: AuthProvider
  ) {
  }

  public init (): void {
    console.log('inicio Servicio Productos')
    /* *************************************** Prods *********** */
    this.sku$ = new BehaviorSubject(null)

    const prodsObserv: Observable<any> = this.sku$.switchMap(sku => {

      return this.angularFirestoreDB.collection(`products/`, ref => {
        return sku ? ref.orderBy('_id', 'asc').startAt(sku).endAt(sku + '\uffff') : ref.orderBy('_id', 'asc')
      }).valueChanges()

    })

    const prodsSub: Subscription = prodsObserv.subscribe(
      prods => {
        this.productos = prods
      },
      err => {
        console.error('error init - providers/productos.ts', err)
        Raven.captureException(new Error(`error init - providers/productos.ts 🐛: ${JSON.stringify(err)}`), {
          extra: err
        })
      }
    )
    /* *************************************** Prods Bogota *********** */
    this.skuBog$ = new BehaviorSubject(null)

    const prodsObservBog: Observable<any> = this.sku$.switchMap(sku => {

      return this.angularFirestoreDB.collection(`prods-bogota/`, ref => {
        return sku ? ref.orderBy('_id', 'asc').startAt(sku).endAt(sku + '\uffff') : ref.orderBy('_id', 'asc')
      }).valueChanges()

    })

    const prodsSubBog: Subscription = prodsObservBog.subscribe(
      prods => {
        this.productosBogota = prods
      },
      err => {
        console.error('error init - providers/productos.ts', err)
        Raven.captureException(new Error(`error init - providers/productos.ts 🐛: ${JSON.stringify(err)}`), {
          extra: err
        })
      }
    )
    /** ************************************************************************ */

    this.evts.subscribe('auth:logout', () => {
      prodsSub.unsubscribe()
      prodsSubBog.unsubscribe()
    })
  }

  public fetchProdsByids (ids: string[]): Producto[] {
    return _.map(ids, (id): Producto => {
      const iProd: number = cg.binarySearch(this.currentProds, '_id', id, true)

      /**
       * esta validacion la hago por si se elimina un producto de la bd
       * por falta de existencias, a veces pasaba que si habia un producto
       * en el carrito y casualmente se elimina, ocurria un error donde
       * no se encontraba el _id
       */
      if (_.has(this.currentProds[iProd], '_id')) {
        return this.currentProds[iProd]
      } else {
        return {
          _id: id,
          titulo: 'producto agotado',
          aplicacion: 'producto agotado',
          imagen: 'https://www.igbcolombia.com/app/assets/img/logo/logo_igb_small.png',
          categoria: null,
          marcas: '',
          unidad: 'UND',
          existencias: 0,
          precio: 0,
          origen: '',
          descuento: 'NULL'
        }
      }

    })
  }
  /**
   * Esta funcion se encarga de actualizar los productos en firestore al crear una orden
   *
   * @param {CarItem[]} carItems
   * @returns {Promise<any>}
   * @memberof ProductosProvider
   */
  public updateQuantity (carItems: CarItem[]): Promise<any> {
    // Create a batch to run an atomic write
    const batch = this.angularFirestoreDB.firestore.batch()
    // Declaro la referencia de los productos para actualizarlos mas adelante
    const collectionProdsRef: AngularFirestoreCollection<any> = this.angularFirestoreDB.collection(this.currentProdBD)
    // en un array guardo solo los ids de los productos del carrito
    const prodsId = _.map(carItems, '_id')

    // Busco los productos del carrito en firestore por sus ids
    const productos: Producto[] = this.fetchProdsByids(prodsId)

    for (const prod of productos) {

      const itemId: number = cg.binarySearch(carItems, '_id', prod._id)
      const docProdRef = collectionProdsRef.doc(prod._id).ref
      batch.update(docProdRef, {
        existencias: prod.existencias - carItems[itemId].cantidad,
        origen: 'app',
        updated_at: Date.now()
      })

    }

    return batch.commit()

  }

  /**
   *
   * este metodo es el encargado de hacer funcionar la busqueda de los productos
   * mediante el ingreso del sku o la descripcion de producto
   *
   * @param {string} query
   * @memberof ProductosProvider
   */
  public async searchAutocomplete (query: string): Promise<Producto[]> {
    const url: string = cg.SEARCH_PRODS_URL
    const params = new HttpParams()
      .set('keyword', query)
    const options = {
      headers: new HttpHeaders({
        'Accept'       : 'application/json',
        'Content-Type' : 'application/json'
      }),
      params: params
    }

    try {

      const res = await this.http.get<Producto[]>(url, options).pipe(
        timeout(10000)
      ).toPromise()

      return res

    } catch (err) {
      console.error('Error searchAutocomplete - providers/productos.ts', err)
      Raven.captureException(new Error(`Error searchAutocomplete - providers/productos.ts 🐛: ${JSON.stringify(err)}`), {
        extra: err
      })
      return []
    }

  }

  /**
   * Este getter me trae la base de datos de productos activa
   *
   * @readonly
   * @type {string}
   * @memberof AuthProvider
   */
  public get currentProdBD (): string {
    return (this.authServ.userData.bodega === '01') ? 'products' : 'prods-bogota'
  }

  /**
   * este getter se encarga de traerme los productos de la bd activa
   *
   * @readonly
   * @type {Producto[]}
   * @memberof ProductosProvider
   */
  public get currentProds (): Producto[] {
    return (this.authServ.userData.bodega === '01') ? this.productos : this.productosBogota
  }

}
