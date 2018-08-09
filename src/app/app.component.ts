import { Component, ViewChild } from '@angular/core'
import { Platform, NavController, MenuController, Events, AlertController, App } from 'ionic-angular'
import { StatusBar } from '@ionic-native/status-bar'
import { SplashScreen } from '@ionic-native/splash-screen'
import { Subscription } from 'rxjs/Subscription'

// libs terceros
import _ from 'lodash'
import Raven from 'raven-js'

// Pages
import { HomePage } from '../pages/home/home'
import { LoginPage } from '../pages/login/login'
import { SplashPage } from '../pages/splash/splash'

// Providers
import { AuthProvider } from '../providers/auth/auth'
import { ConfigProvider } from '../providers/config/config'
import { OrdenProvider } from '../providers/orden/orden'
import { CarritoProvider } from '../providers/carrito/carrito'
import { ProductosProvider } from '../providers/productos/productos'
import { GeolocationProvider } from '../providers/geolocation/geolocation'

// Models
import { User } from '../providers/auth/model/user'

@Component({
  templateUrl: 'app.html'
})
export class MyApp {

  // como pagina principal asigno una pagina vacia para hacer una funcion
  // parecida a un splas screen mientras el servicio de autenticacion inicia y escoge
  // la pagina adecuada
  private rootPage: any = SplashPage
  private authObserver: Subscription
  @ViewChild('content') private content: NavController
  private appVer: string = ConfigProvider.APP_VER
  // guardo el estado del boton para verficar las ordenes
  // si alguien lo clickea este deshabilita hasta que las ordenes
  // se envien y sap responda, esto para evitar que envien las ordenes
  // muchas veces
  private btnVerifOrdState: boolean = false

  constructor (
    platform: Platform,
    statusBar: StatusBar,
    splashScreen: SplashScreen,
    app: App,
    private alertCtrl: AlertController,
    private menuCrl: MenuController,
    private authServ: AuthProvider,
    private cgServ: ConfigProvider,
    private ordenServ: OrdenProvider,
    private cartServ: CarritoProvider,
    private prodsServ: ProductosProvider,
    private geoServ: GeolocationProvider,
    private evts: Events
  ) {

    platform.ready().then(() => {
      // Okay, so the platform is ready and our plugins are available.
      // Here you can do any higher level native things you might need.
      statusBar.styleDefault()
      splashScreen.hide()
    })
    /**
     * Cancelo el comportamiento del boton de back por hardware
     * de los celulares, ya que me estaba produciendo errores en
     * la base de datos sqlite
     */
    platform.registerBackButtonAction(() => {

      const nav = app.getActiveNavs()[0]
      const activeView = nav.getActive()

      if (nav.canGoBack()) { // Can we go back?
        nav.pop()
      } else {
        console.log('Application exit prevented!')
      }

    })

    this.authObserver = authServ.userObservable.subscribe(
      (user: User) => {

        if (user && authServ.userSession) {
          console.log('authObserver')
          this.prodsServ.init()
          this.cartServ.initDB()
          this.ordenServ.init()
          this.cgServ.setTimerCheckJosefa() // inicio el timer que verifica el token de josefa no este vencido
          this.ordenServ.setIntervalOrdersSap() // inicio el timer que verifica las ordenes

          // Aqui le digo a sentry cual es el usuario q esta usando la app
          Raven.setUserContext({
            username: this.authServ.userData.username,
            email: this.authServ.userData.email,
            id: this.authServ.userData.uid
          })
          // Inicio el rastreo de los usuarios
          geoServ.startTracking()
          // Pagina a mostrar
          this.rootPage = 'TabsPage'
        } else {
          Raven.setUserContext()
          // Cuando el usuario cierra sesion apago el rastreo
          geoServ.stopTracking()
          this.rootPage = LoginPage
        }
      },
      err => {
        console.error('Error subscribe data user- app.component', err)
        Raven.captureException(new Error(`Error subscribe data user- app.component 🐛: ${JSON.stringify(err)}`), {
          extra: err
        })
      }
    )

    this.evts.subscribe('timer:checkTokenJosefa', () => {
      this.logout()
    })

  }

  private cargarPagina (pagina: any): void {
    this.content.setRoot(pagina)
    this.menuCrl.close()
  }

  private logout (): void {
    const loading = this.cgServ.showLoading()
    this.authServ.logout().then((d) => {
      this.cargarPagina(LoginPage)
      loading.dismiss()
      clearInterval(this.ordenServ.intervalValOrders) // Paro el timer que verifica las ordenes
      clearInterval(this.cgServ.timerCheckTokenJose) // Paro el timer que verifica el token de josefa no este vencido
      this.cartServ.destroyDB()
    }).catch(err => {
      loading.dismiss()
      console.error('Error cerrando sesion - app.component', err)
      Raven.captureException(new Error(`Error cerrando sesion - app.component 🐛: ${JSON.stringify(err)}`), {
        extra: err
      })
    })

  }

  private verificarOrdenes (): void {

    if (this.ordenServ.ordenesPendientes.length > 0) {
      this.btnVerifOrdState = true
      this.ordenServ.sendOrdersSap()
      .then(responses => {
        const failOrders = _.filter(responses.apiRes, (res: any) => {
          return res.responseApi.code >= 400
        })
        if (failOrders.length > 0) {
          this.alertCtrl.create({
            title: 'Advertencia.',
            message: failOrders.length + ' ordenes no se han podido subir a sap, verifique su conexion a internet y vuelva a intentarlo',
            buttons: ['Ok']
          }).present()
        } else {
          this.alertCtrl.create({
            title: 'Info.',
            message: 'Las ordenes se subieron correctamente a sap.',
            buttons: ['Ok']
          }).present()
        }
        console.warn('RESPUESTA DE LAS ORDENES ', responses)
        this.btnVerifOrdState = false
      })
      .catch(err => {
        this.btnVerifOrdState = false
        console.error('Error verificarOrdenes - app.component', err)
        Raven.captureException(new Error(`Error verificarOrdenes - app.component 🐛: ${JSON.stringify(err)}`), {
          extra: err
        })
      })
    }

  }

  private reloadApp (): void {
    window.location.reload()
  }

  private async changeWarehouse (): Promise<any> {
    this.alertCtrl.create({
      title: 'Cambiar bodega ?',
      message: 'Recuerde que al cambiar la bodega todos los productos del carrito se van a borrar, aun asi desea cambiar la bodega ?',
      enableBackdropDismiss: false,
      buttons: [
        {
          text: 'Si',
          handler: () => {
            // Cambio la bodega
            this.authServ.changeWarehouse()
              .then(() => {
                // Si el cambio de bodega se realiza correctamente elimino el carrito
                return this.cartServ.destroyDB(true)
              })
              .then(() => {
                // si el carrito se elimina correctamente recargo la app
                this.reloadApp()
              })
              .catch(err => {
                this.cgServ.showToast('Error al cambiar la bodega!')
                console.error('Error changeWarehouse - app.component', err)
                Raven.captureException(new Error(`Error changeWarehouse - app.component 🐛: ${JSON.stringify(err)}`), {
                  extra: err
                })
              })

          }
        },
        {
          text: 'No',
          role: 'cancel'
        }
      ]
    }).present()
  }

}
