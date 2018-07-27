import { Injectable } from '@angular/core'
import { Events } from 'ionic-angular'
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http'
import { Storage } from '@ionic/storage'

/* Maricadas de Rxjs */
import { BehaviorSubject } from 'rxjs/BehaviorSubject'
import { Observable } from 'rxjs/Observable'
import { Subscription } from 'rxjs/Subscription'
import { timeout } from 'rxjs/operators/timeout'
import { map, catchError } from 'rxjs/operators'
import { forkJoin } from 'rxjs/observable/forkJoin'

// Libs terceros
import * as _ from 'lodash'
import * as moment from 'moment'
import Raven from 'raven-js'

// AngularFire - Firestore
import { AngularFirestore, AngularFirestoreDocument, AngularFirestoreCollection } from 'angularfire2/firestore'
import * as firebase from 'firebase'

// Models
import { Orden } from './models/orden'
import { CarItem } from '../carrito/models/carItem'

// Providers
import { AuthProvider } from '../auth/auth'
import { ConfigProvider as cg } from '../config/config'

@Injectable()
export class OrdenProvider {

  private ordenesRef: AngularFirestoreCollection<any>
  public ordenes: Orden[] = []
  public intervalValOrders: NodeJS.Timer

  constructor (
    private authServ: AuthProvider,
    private util: cg,
    private angularFirestoreDB: AngularFirestore,
    private evts: Events,
    private storage: Storage,
    private http: HttpClient
  ) {
  }

  public init (): void {
    console.log('inicio Servicio Ordenes')
    this.ordenesRef = this.angularFirestoreDB.collection(`users/`).doc(this.authServ.userData.uid).collection('orders')
    const ordenesObserv = this.ordenesRef.valueChanges().subscribe(
      ordenes => {
        this.ordenes = ordenes
      },
      err => {
        console.error('error al subs a las ordenes init providers/orden.ts', err)
        Raven.captureException(new Error(`error al subs a las ordenes init providers/orden.ts 🐛: ${JSON.stringify(err)}`), {
          extra: err
        })
      }
    )
    this.evts.subscribe('auth:logout', () => {
      ordenesObserv.unsubscribe()
    })
  }

  public pushItem (orden: Orden): Promise<any> {
    orden.updated_at = Date.now().toString()
    const ordenDoc: AngularFirestoreDocument<Orden> = this.ordenesRef.doc<Orden>(orden._id)
    return ordenDoc.set(orden)
  }

  public async sendOrdersSap (): Promise<any> {

    if (!this.util.onlineOffline) {
      return Promise.reject({
        message: 'No hay conexión, su pedido no puede ser procesado.'
      })
    }

    const token = await this.storage.get('josefa-token')
    const url: string = cg.JOSEFA_URL + '/sap/order_motorzone'

    const ordenesCalls: Observable<any>[] = _.map(this.ordenesPendientes, (orden: Orden) => {

      // mapeo los productos de la orden segun el formato del api
      const items: any = _.map(orden.items, (item: CarItem) => {
        return {
          referencia : item._id,
          cantidad   : item.cantidad,
          titulo     : item.titulo,
          total      : item.totalPrice,
          bodega     : this.authServ.userData.bodega,
          descuento  : 0
        }
      })

      const body: string = JSON.stringify({
        id             : orden._id,
        fecha_creacion : moment(parseInt(orden._id, 10)).format('YYYY-MM-DD'),
        nit_cliente    : orden.nitCliente,
        trasportadora  : orden.transp,
        comentarios    : orden.observaciones + ` ##${this.authServ.userData.idAsesor}## ++${cg.APP_VER}++`,
        productos      : items,
        asesor         : this.authServ.userData.username,
        asesor_id      : this.authServ.userData.idAsesor,
        user_email     : this.authServ.userData.email,
        total          : orden.total
      })
      const options = {
        headers: new HttpHeaders({
          'Accept'       : 'application/json',
          'Content-Type' : 'application/json',
          'Authorization': 'Bearer ' + token
        })
      }

      return this.http.post<any>(url, body, options).pipe(
        map((res: Response) => {
          /**
           * Si la respuesta de la api no tiene ningun error, y la orden se crea
           * y entra correctamente a sap devuelvo entonces la respuesta y la orden
           */
          return {
            orden       : orden,
            responseApi : res
          }
        }),
        catchError(err => {
          return Observable.of({
            orden       : orden,
            responseApi : err
          })
        })
        // timeout(7000),
      )

    })

    // Guardo las respuestas que me delvuelve el api sobre los pedidos hechos
    const ordenesApiRes = await forkJoin(ordenesCalls).toPromise()

    const pushItemsRes = await Promise.all(
      _.map(ordenesApiRes, (res: any, k, l) => {
        if (res.responseApi.code === 201 && _.has(res.responseApi, 'data.DocumentParams.DocEntry')) {
          res.orden.estado = true
          res.orden.error = ''
          res.orden.docEntry = res.responseApi.data.DocumentParams.DocEntry
          return this.pushItem(res.orden)
        } else {
          let error: any
          if (_.has(res.responseApi, 'data')) {
            error = (res.responseApi.data) ? JSON.stringify(res.responseApi.data) : JSON.stringify(res.responseApi)
          } else {
            error = JSON.stringify(res.responseApi)
            res.responseApi.code = 400
          }
          res.orden.error = error
          return this.pushItem(res.orden)
        }
      })
    )

    return {
      apiRes     : ordenesApiRes,
      localdbRes : pushItemsRes
    }

  }

  public setIntervalOrdersSap (): void {
    this.intervalValOrders = setInterval(() => {

      if (this.ordenesPendientes.length > 0) {

        this.sendOrdersSap()
        .then(responses => {
          const failOrders = _.filter(responses.apiRes, (res: any) => {
            return res.responseApi.code >= 400
          })
          if (failOrders.length > 0) {
            console.error(failOrders.length + ' ordenes no se han podido subir a sap, verifique su conexion a internet y vuelva a intentarlo', failOrders)
          } else {
            this.util.showToast('Las ordenes se subieron correctamente a sap.')
          }
          console.warn('RESPUESTA DE LAS ORDENES ', responses)
        })
        .catch(err => {
          console.error('Error setIntervalOrdersSap - providers/orden.ts', err)
          Raven.captureException(new Error(`Error setIntervalOrdersSap - providers/orden.ts 🐛: ${JSON.stringify(err)}`), {
            extra: err
          })
        })

      }

    }, 60000)
  }

  /**
   * Getter que me trae las ordenes pendientes
   *
   * @readonly
   * @type {Orden[]}
   * @memberof OrdenProvider
   */
  public get ordenesPendientes (): Orden[] {
    const ordenesPendientes: Orden[] = _.filter(this.ordenes, ['estado', false])
    return JSON.parse(JSON.stringify(ordenesPendientes))
  }

  /**
   * Getter que me trae todas los ordenes
   *
   * @readonly
   * @type {Orden[]}
   * @memberof OrdenProvider
   */
  public get ordenesDesc (): Orden[] {
    if (this.ordenes) {
      return _.orderBy(this.ordenes, '_id', 'desc')
    } else {
      return []
    }
  }

}
