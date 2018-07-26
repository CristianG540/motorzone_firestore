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
import { AngularFireDatabase, AngularFireList } from 'angularfire2/database'
import * as firebase from 'firebase'

// Models
import { Producto } from './models/producto'
import { CarItem } from '../carrito/models/carItem'

// Providers
import { ConfigProvider as cg } from '../config/config'

@Injectable()
export class ProductosProvider {

  public productos: Producto[]
  public sku$: BehaviorSubject<string | null>

  constructor (
    private angularFireDB: AngularFireDatabase,
    private evts: Events,
    private http: HttpClient
  ) {
  }

  public init (): void {
    this.sku$ = new BehaviorSubject(null)

    const prodsObserv: Observable<any> = this.sku$.switchMap(sku => {

      return this.angularFireDB.list(`products/`, ref => {
        return sku ? ref.orderByKey().startAt(sku).endAt(sku + '\uffff').limitToFirst(100) : ref.limitToFirst(100)
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
    this.evts.subscribe('auth:logout', () => {
      prodsSub.unsubscribe()
    })
  }

  public async fetchProdsByids (ids: string[]): Promise<Producto[]> {

    const prodPromises: Promise<any>[] = _.map(ids, (v) => {
      return firebase.database().ref(`products/${v}`).once('value')
    })

    const prodsSnapshots = await Promise.all(prodPromises)

    return _.map(prodsSnapshots, (snapshot: any) => {

      const producto: Producto = snapshot.val()

      /**
       * esta validacion la hago por si se elimina un producto de la bd
       * por falta de existencias, a veces pasaba que si habia un producto
       * en el carrito y casualmente se elimina, ocurria un error donde
       * no se encontraba el _id
       */
      if (_.has(producto, '_id')) {
        return producto
      } else {
        return new Producto(
          snapshot.key,
          'producto agotado',
          'producto agotado',
          'https://www.igbcolombia.com/app/www/assets/img/logo/logo_igb_small.png',
          null,
          '',
          'UND',
          0,
          0,
          ''
        )
      }

    })
  }
  /**
   * Esta funcion se encarga de actualizar los productos en firebase al crear una orden
   *
   * @param {CarItem[]} carItems
   * @returns {Promise<any>}
   * @memberof ProductosProvider
   */
  public async updateQuantity (carItems: CarItem[]): Promise<any> {
    // Declaro la referencia de los productos para actualizarlos mas adelante
    const prodsRef: AngularFireList<any> = this.angularFireDB.list(`products/`)
    // en un array guardo solo los ids de los productos del carrito
    const prodsId = _.map(carItems, '_id')

    // Busco los productos del carrito en firebase por sus ids
    const productos: Producto[] = await this.fetchProdsByids(prodsId)

    // en un array guardo una a una las promsesas de actualizacion de cada producto
    const updatePromises: Promise<any>[] = _.map(productos, (prod: Producto) => {
      const itemId = cg.binarySearch(carItems, '_id', prod._id)

      return prodsRef.update(prod._id, {
        existencias: prod.existencias - carItems[itemId].cantidad,
        origen: 'app',
        updated_at: Date.now()
      })
    })

    // ejecuto todas las promesas del array y devuelvo los valores que devuelven dichas promesas
    return Promise.all(updatePromises)

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

}
