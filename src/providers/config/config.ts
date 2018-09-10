import { Injectable } from '@angular/core'
import { LoadingController, Loading, AlertController, ToastController, Events } from 'ionic-angular'
import { Storage } from '@ionic/storage'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { map } from 'rxjs/operator/map'

// libs terceros
import Raven from 'raven-js'

@Injectable()
export class ConfigProvider {

  static readonly APP_VER: string = '1.0.2'
  static readonly firebaseConfig = {
    apiKey: 'AIzaSyDz-mE75HwL7w2NerpJLEa_Y6VgWJNKxCE',
    authDomain: 'motorzone-efef6.firebaseapp.com',
    databaseURL: 'https://motorzone-efef6.firebaseio.com',
    projectId: 'motorzone-efef6',
    storageBucket: 'motorzone-efef6.appspot.com',
    messagingSenderId: '797056667535'
  }
  // Url base de la BD de los Clientes en couch
  static readonly CDB_URL_CLIENTES: string = 'https://www.gatortyres.com:6984/clientes'
  static readonly CDB_USER: string = 'admin'
  static readonly CDB_PASS: string = 'admin'
  static readonly SEARCH_CLIENTS_URL: string = `https://www.gatortyres.com:1339/clientes/motorzone/search`
  static readonly SEARCH_PRODS_URL: string = `https://www.gatortyres.com:1339/prods/motorzone/search`
  static readonly JOSEFA_URL: string = 'https://gatortyres.com'
  static readonly G_MAPS_KEY: string = 'AIzaSyAtVh-4gg1RRcS_jUlDtatc6SjwP-5XI70'

  public onlineOffline: boolean = navigator.onLine
  public timerCheckTokenJose: NodeJS.Timer

  constructor (
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private http: HttpClient,
    private storage: Storage,
    private evts: Events
  ) {
  }

  public showLoading (): Loading {
    const loading: Loading = this.loadingCtrl.create({
      content: 'Espere por favor...'
    })
    loading.present()
    return loading
  }

  public errorHandler (err: string, errObj?: any, loading?: Loading): void {
    if (loading) { loading.dismiss() }
    this.alertCtrl.create({
      title: 'Ocurrio un error.',
      message: err,
      buttons: ['Ok']
    }).present()
    console.error('Se presento el error: ', errObj)
    Raven.captureException(new Error(`Se presento el error 🐛: ${JSON.stringify(errObj)}`), {
      extra: errObj
    })
  }

  /**
   * Esta funcion me crea una alerta con un input para preguntarle al
   * usuario cuantas unidades del producto va a agregar al carrito
   *
   * @param {*} handler este parametro recibe una funcion con un parametro data que recibe
   * la cantidad que el usuario ingreso en el input
   * @memberof Config
   */
  public promptAlertCant (handler: any): void {
    this.alertCtrl.create({
      title: 'Agregar cantidad',
      enableBackdropDismiss: false,
      inputs: [{
        name: 'txtCantidad',
        id: 'idTxtCant',
        type: 'number',
        placeholder: 'Cantidad'
      }],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Agregar',
          handler: handler
        }
      ]
    })
    .present()
    .then(() => {
      const firstInput: any = document.querySelector('ion-alert input')
      firstInput.focus()
      return
    })
  }

  public showToast (msg: string): void {
    this.toastCtrl.create({
      message: msg,
      duration: 3000,
      position: 'top',
      showCloseButton: false,
      closeButtonText: 'cerrar'
    }).present()
  }

  public async checkToken (): Promise<any> {
    let token: string = ''
    try {
      token = await this.storage.get('josefa-token')
    } catch (e) {
      console.error('Error al recuperal el token de josefa del storage: ', e)
      e.statusText = 'Unauthorized'
      throw new Error(e.statusText)
    }

    const url: string = ConfigProvider.JOSEFA_URL + '/sap'
    const options = {
      headers: new HttpHeaders({
        'Accept'       : 'application/json',
        'Content-Type' : 'application/json',
        'Authorization': 'Bearer ' + token
      })
    }

    try {
      const res = await this.http.get(url, options).pipe(
      ).toPromise()
      return res
    } catch (e) {
      console.error('Error al checkear el token de josefa: ', e)
      throw new Error(e.statusText)
    }

  }

  public setTimerCheckJosefa (): void {
    this.timerCheckTokenJose = setInterval(() => {

      if (this.onlineOffline) {

        this.checkToken().then(res => {
          console.log('estado del api josefa', res)
        }).catch((e: Error) => {
          if (e.message === 'Unauthorized') {
            this.evts.publish('timer:checkTokenJosefa')
          }
        })

      }

    }, 60000)
  }

  /**
   * Esta es una version mas rapida del "_.find" de lodash :3
   * Gracias a https://pouchdb.com/2015/02/28/efficiently-managing-ui-state-in-pouchdb.html
   * @static
   * @param {any[]} arr array de objetos donde voy a buscar wl valor
   * @param {string} property propiedad del objeto que contiene el valor q busco
   * @param {*} search lo que estoy buscando en el array
   * @param {boolean} [strict] si este parametro es verdadero la busqueda me devuelve error
   * si no encuentra el valor exacto que busco, de lo contrario me va a devolver el valor q mas se aproxime
   * @returns {number}
   * @memberof ConfigProvider
   */
  static binarySearch (arr: any[], property: string, search: any, strict?: boolean): number {
    let low: number = 0
    let high: number = arr.length
    let mid: number
    while (low < high) {
      mid = (low + high) >>> 1 // faster version of Math.floor((low + high) / 2)
      arr[mid][property] < search ? low = mid + 1 : high = mid
    }

    /**
     * lo que hago aqui es verificar si lo que busco en el array existe
     * por ejemplo si un array de productos estoy buscando el codigo "MF3021"
     * verifico que la posicion que me devuelve la funcion si sea la correcta
     * si no hago esto, lo que va a pasar es que si el codigo no exste en el array de prodcutos
     * la funcion me va a devolver el indice del codigo que mas se paresca
     */
    if (strict) {
      if (arr[low][property] === search) {
        return low
      } else {
        return 99999
      }
    }

    return low
  }

}
