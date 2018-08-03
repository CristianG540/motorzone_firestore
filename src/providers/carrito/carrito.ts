import { Injectable } from '@angular/core'
import { Events } from 'ionic-angular'

// Libs terceros
import _ from 'lodash'
import PouchDB from 'pouchdb'
import PouchUpsert from 'pouchdb-upsert'
import cordovaSqlitePlugin from 'pouchdb-adapter-cordova-sqlite'
import Raven from 'raven-js'

// Providers
import { ConfigProvider as cg } from '../../providers/config/config'

// Models
import { Producto } from '../productos/models/producto'
import { CarItem } from './models/carItem'

@Injectable()
export class CarritoProvider {

  private _db: any
  private _carItems: CarItem[] = []
  public descuento: number = 0

  constructor (
    public evts: Events
  ) {
  }

  public initDB () {
    PouchDB.plugin(PouchUpsert)
    PouchDB.plugin(cordovaSqlitePlugin)
    const dbConf = { adapter: 'cordova-sqlite', iosDatabaseLocation: 'default' }
    this._db = new PouchDB('cart.db', dbConf)
    this.fetchAndRenderAllDocs()
      .then(res => {
        this._reactToChanges()
      })
      .catch(err => {
        console.error('Error initDB - providers/carrito.ts', err)
        Raven.captureException(new Error(`Error initDB - providers/carrito.ts 🐛: ${JSON.stringify(err)}`), {
          extra: err
        })
      })
  }

  public pushItem (item: CarItem): Promise<any> {

    return new Promise((resolve, reject) => {

      this.checkBodega(item).then(val => {

        switch (val) {
          case 'ok':
            /**
             * hago una busqueda binaria para saber si el producto esta en el carrito
             * si ya esta en el carrito, le informo al usuario q no lo puede agregar
             */
            const indexPrevItem: number = cg.binarySearch(
              this._carItems,
              '_id',
              item._id
            )
            const prevItem: CarItem = this._carItems[indexPrevItem]
            if (prevItem && prevItem._id === item._id) {
              reject('duplicate')
            } else {
              /**
               * inserto los datos en la bd local
               */
              this._db.put(item).then(res => {
                /**
                 * Lo que hago aqui es usar la funcion "sortedLastIndexBy" de lodash
                 * mas info aqui: "https://lodash.com/docs/4.17.4#sortedLastIndexBy"
                 * con este codigo lo q hago conservar el orden de los productos cada
                 * vez que los voy ingresando, asi a la hora de leerlos ya estan ordenados
                 * y la busqueda binaria funciona full HD
                 */
                // let i = _.sortedLastIndexBy(this._carItems, item, v => v._id );
                // this._carItems.splice(i, 0, item);
                resolve(res)
              }).catch(err => {
                reject(err)
              })
            }
            break
          case 'mtz_filtros_flag':
            reject('mtz_filtros_flag')
            break
          default:
            break
        }
      }).catch(err => {
        reject(err)
      })

    })

  }

  /** *************** Manejo de el estado de la ui    ********************** */
  public fetchAndRenderAllDocs (): Promise<any> {

    return this._db.allDocs({
      include_docs: true
    }).then(res => {
      this._carItems = res.rows.map((row) => {
        return {
          _id : row.doc._id,
          cantidad : row.doc.cantidad,
          totalPrice : row.doc.totalPrice,
          _rev : row.doc._rev
        }
      })
      console.log('_all_docs carrito pouchD', res)
      return res
    })

  }

  private _reactToChanges (): void {
    this._db.changes({
      live: true,
      since: 'now',
      include_docs: true
    })
    .on('change', change => {

      if (change.deleted) {
        // change.id holds the deleted id
        this._onDeleted(change.id)
      } else { // updated/inserted
        // change.doc holds the new doc
        this._onUpdatedOrInserted({
          _id : change.doc._id,
          cantidad : change.doc.cantidad,
          titulo : change.doc.titulo,
          totalPrice : change.doc.totalPrice,
          _rev : change.doc._rev
        })
      }
    })
    .on('err', err => {
      console.error('Error _reactToChanges - providers/carrito.ts', err)
      Raven.captureException(new Error(`Error _reactToChanges - providers/carrito.ts 🐛: ${JSON.stringify(err)}`), {
        extra: err
      })
    })
  }

  private _onUpdatedOrInserted (newDoc: CarItem): void {
    const index: number = cg.binarySearch(
      this._carItems,
      '_id',
      newDoc._id
    )
    const doc = this._carItems[index]
    if (doc && doc._id === newDoc._id) { // update
      this._carItems[index] = newDoc
    } else { // insert
      this._carItems.splice(index, 0, newDoc)
    }
  }

  private _onDeleted (id: string): void {
    const index: number = cg.binarySearch(
      this._carItems,
      '_id',
      id
    )
    const doc = this._carItems[index]
    if (doc && doc._id === id) {
      this._carItems.splice(index, 1)
      // Si elimino el ultimo producto del carrito
      // entonces limpio las banderas que me restringen ingresar
      // filtros junto otras cosas
      if (this._carItems.length === 0) {
        this.cleanFlags()
      }
      // lanzo este evento para actualizar la pagina cuando un item
      // del carrito se elimina
      this.evts.publish('cart:change')
    }
  }

  /** *********** Fin Manejo de el estado de la ui    ********************** */

  /** ********************** Manejo del tema de filtros ********************************* */
  /**
   * Checkea si la bandera indicada en "flagId" existe o no existe
   * de esta manera puedo saber por ejemplo si se estan agregando llantas
   * al pedido creando la bandera "_local/mtz_filtros_flag" o si se estan agregando
   * otra cosa, si se agregan filtros no se pueden agregar aceites etc
   *
   * @private
   * @param {string} flagId
   * @returns {Promise<boolean>}
   * @memberof CarritoProvider
   */
  private async checkFlag (flagId: string): Promise<boolean> {
    try {
      const flag = await this._db.get(flagId)
      return true
    } catch (err) {
      return false
    }
  }

  /**
   * Verifica la accion a tomar al agregar un item al carrito
   * por ejemplo verifica que no se puedan agregar llantas
   * si estan pidiendo repuestos o verifica que no se agreguen repuestos
   * si son llantas
   *
   * @private
   * @param {CarItem} item el item del carrito a verificar
   * @returns {Promise<string>} Retorna un texto que indica la accion a tomar
   * @memberof CarritoProvider
   */
  private async checkBodega (item: CarItem): Promise<string> {
    // COMENTO EL CODIGO POR EL MOMENTO NO SE LE DA USO DEBIDO A LAS POLITICAS DE MOTORZONE
    // NO LO ELIMINO POR Q LO PUEDO VOLVER A NECESITAR
    /*
    // miro si la bandera de filtros esta creada, y verifico si el item
    // que se esta ingresando no es un filtro, si no es un filtro
    // y la bandera esta creada entonces devuelvo un error que le indica al usuario
    // que solo puede agregar filtros al carrito
    const filtrosFlag: boolean = await this.checkFlag('_local/mtz_filtros_flag')

    if (filtrosFlag) {
      if (item._id.substring(0, 2) === 'MF') {
        if (item.titulo.substring(0, 6) !== 'FILTRO') {
          return 'mtz_filtros_flag'
        }
      } else {
        return 'mtz_filtros_flag'
      }
    }

    // La primera vez que un item se agrega al carrito verifico si es un filtro
    // asi decido q bandera crear, y de ahi en adelante solo se
    // podran agregar productos de ese tipo al carrito
    if (item._id.substring(0, 2) === 'MF' && item.titulo.substring(0, 6) === 'FILTRO') {
      await this._db.putIfNotExists({
        _id: '_local/mtz_filtros_flag'
      })
    }
    */
    return 'ok'
  }

  /**
   * Esta funcion se encarga de eliminar las banderas
   *
   * @private
   * @returns {Promise<any>}
   * @memberof CarritoProvider
   */
  private async cleanFlags (): Promise<any> {
    try {
      // tslint:disable-next-line:variable-name
      const mtz_filtros_flag = await this._db.get('_local/mtz_filtros_flag')
      await this._db.remove(mtz_filtros_flag)
    // tslint:disable-next-line:no-empty
    } catch (error) {}

  }
  /** ********************** Fin Manejo del tema de restricciones de productos ********************************* */

  public deleteItem (prod: Producto): Promise<any> {

    const carItemIndex = cg.binarySearch(
      this._carItems,
      '_id',
      prod._id
    )
    return this._db.remove(this._carItems[carItemIndex])
      .then(res => {
        return res
      })
  }

  /**
   * Esta funcion se encarga de eliminar la base datos del carrito
   * se usa en varias ocaciones como al finalizar un pedido o al cerrar
   * la sesion, el parametro init sirve para iniciar de nuevo la base de datos
   * esto sirve por ejemplo al terminar el pedido que se borra la bd pero se crea
   * de nuevo para seguir haciendo pedidos
   *
   * @param {boolean} [init=false]
   * @memberof CarritoProvider
   */
  public destroyDB (init: boolean = false): Promise<any> {
    return this._db.destroy().then(() => {
      this._carItems = []
      // Limpio las banderas de las restricciones de productos
      this.cleanFlags()
      if (init) {
        return this.initDB()
      }
    })
  }

  /**
   * Busco el producto en los items del carrito para saber la cantidad que se ha
   * pedido de cada producto
   *
   * @private
   * @param {Producto} prod
   * @returns {number}
   * @memberof CarritoPage
   */
  public getProdCant (prod: Producto): number {
    const carItemIndex = cg.binarySearch(
      this.carItems,
      '_id',
      prod._id
    )
    try {
      return this.carItems[carItemIndex].cantidad
    } catch (err) {
      return 0
    }

  }

  public setProdCant (cantPedido: number, prod: Producto): void {

    const carItemIndex = cg.binarySearch(
      this.carItems,
      '_id',
      prod._id
    )
    this._carItems[carItemIndex].cantidad = cantPedido
    this._carItems[carItemIndex].totalPrice = prod.precio * cantPedido
    this._db.put(this._carItems[carItemIndex])
      .catch(err => {
        console.error('Error setProdCant - providers/carrito.ts', err)
        Raven.captureException(new Error(`Error setProdCant - providers/carrito.ts 🐛: ${JSON.stringify(err)}`), {
          extra: err
        })
      })
  }

  /**
   * Getter que me trae todos los productos en el carrito
   * un array q contiene objetos con el sku del producto
   * y la cantidad de productos q se van a pedir
   *
   * @readonly
   * @type {CarItem[]}
   * @memberof CarritoProvider
   */
  public get carItems (): CarItem[] {
    return JSON.parse(JSON.stringify(this._carItems))
  }

  /**
   * Este Getter me trae un array con todos los skus de los productos
   * en el carrito, este lo uso para hacer una busqueda en couchdb y traer
   * los productos del carrito
   *
   * @readonly
   * @type {*}
   * @memberof CarritoProvider
   */
  public get carIdItems (): any {
    return _.map(this._carItems, '_id')
  }

  /**
   * Getter que me trae el total del pedido sin en el iva
   *
   * @readonly
   * @type {number}
   * @memberof CarritoProvider
   */
  public get subTotalPrice (): number {
    return _.reduce(this._carItems, (acum, item: CarItem) => {
      return acum + item.totalPrice
    }, 0)
  }

  /**
   * getter recupera el iva del pedido
   *
   * @readonly
   * @type {number}
   * @memberof CarritoProvider
   */
  public get ivaPrice (): number {
    return this.subTotalPrice * 19 / 100
  }

  /**
   * Getter que me recupera el total del valor de los productos en el carrito
   * incluyendo el iva
   *
   * @readonly
   * @type {number}
   * @memberof CarritoProvider
   */
  public get totalPrice (): number {
    return this.subTotalPrice + this.ivaPrice - (this.subTotalPrice * this.descuento / 100)
  }

}
