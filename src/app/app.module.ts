import { BrowserModule } from '@angular/platform-browser'
import { ErrorHandler, NgModule } from '@angular/core'
import { HttpClientModule } from '@angular/common/http' // angular >5
import { IonicApp, IonicErrorHandler, IonicModule } from 'ionic-angular'
import { SplashScreen } from '@ionic-native/splash-screen'
import { StatusBar } from '@ionic-native/status-bar'

// Plugins Ionic
import { Geolocation } from '@ionic-native/geolocation'
import { Diagnostic } from '@ionic-native/diagnostic'
import { LocationAccuracy } from '@ionic-native/location-accuracy'
import { IonicStorageModule } from '@ionic/storage'

// Paginas
import { MyApp } from './app.component'
import { HomePage } from '../pages/home/home'
import { LoginPage } from '../pages/login/login'
import { SplashPage } from '../pages/splash/splash'
import { ClientesPage } from '../pages/clientes/clientes'
import { CarteraPage } from '../pages/cartera/cartera'

// Providers
import { ConfigProvider } from '../providers/config/config'
import { SongProvider } from '../providers/song/song'
import { AuthProvider } from '../providers/auth/auth'
import { ProductosProvider } from '../providers/productos/productos'
import { CarritoProvider } from '../providers/carrito/carrito'
import { ClientesProvider } from '../providers/clientes/clientes'
import { GeolocationProvider } from '../providers/geolocation/geolocation'
import { OrdenProvider } from '../providers/orden/orden'
import { CarteraProvider } from '../providers/cartera/cartera'

// manejo de errores sentry
import { SentryErrorHandler } from '../providers/error-handler/sentry-errorhandler'

// Libs terceros
import { AngularFireModule } from 'angularfire2'
import { AngularFireDatabaseModule, AngularFireDatabase } from 'angularfire2/database'
import { AngularFireAuthModule } from 'angularfire2/auth'
import { AngularFirestoreModule } from 'angularfire2/firestore'

@NgModule({
  declarations: [
    MyApp,
    HomePage,
    LoginPage,
    SplashPage,
    ClientesPage,
    CarteraPage
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    IonicModule.forRoot(MyApp),
    IonicStorageModule.forRoot({
      name: '_ionicstorage',
      driverOrder: ['indexeddb', 'sqlite', 'websql']
    }),
    AngularFireModule.initializeApp(ConfigProvider.firebaseConfig),
    AngularFireDatabaseModule,
    AngularFireAuthModule,
    AngularFirestoreModule
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    MyApp,
    HomePage,
    LoginPage,
    SplashPage,
    ClientesPage,
    CarteraPage
  ],
  providers: [
    StatusBar,
    SplashScreen,
    { provide: ErrorHandler, useClass: SentryErrorHandler },
    AngularFireDatabase,
    ConfigProvider,
    SongProvider,
    AuthProvider,
    ProductosProvider,
    CarritoProvider,
    CarritoProvider,
    ClientesProvider,
    GeolocationProvider,
    Geolocation,
    Diagnostic,
    LocationAccuracy,
    OrdenProvider,
    GeolocationProvider,
    CarteraProvider
  ]
})
export class AppModule {}
