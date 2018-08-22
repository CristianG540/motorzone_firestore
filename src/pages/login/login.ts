import { Component } from '@angular/core'
import {
  IonicPage,
  NavController,
  NavParams,
  MenuController,
  AlertController
} from 'ionic-angular'
import { FormGroup, FormBuilder, Validators } from '@angular/forms'

// libs terceros
import Raven from 'raven-js'

// Providers
import { AuthProvider } from '../../providers/auth/auth'
import { ConfigProvider } from '../../providers/config/config'

@Component({
  selector: 'page-login',
  templateUrl: 'login.html'
})
export class LoginPage {
  private loginForm: FormGroup
  private username: string
  private password: string

  private backgroundImage = 'assets/img/background/background-3.jpg'

  constructor (
    private navCtrl: NavController,
    private menuCtrl: MenuController,
    private alertCtrl: AlertController,
    private fb: FormBuilder,
    private navParams: NavParams,
    private authServ: AuthProvider,
    private cgServ: ConfigProvider
  ) {
    this.menuCtrl.enable(false)
  }

  // Runs when the page is about to enter and become the active page.
  ionViewWillLoad () {
    this.initializeForm()
  }

  private initializeForm (): void {
    this.loginForm = this.fb.group({
      email: ['', Validators.required],
      password: ['', Validators.required]
    })
  }

  private login (): void {
    const loading = this.cgServ.showLoading()
    const formModel = JSON.parse(JSON.stringify(this.loginForm.value))
    this.authServ
      .login(formModel.email, formModel.password)
      .then(res => {
        return this.authServ.getTokenJosefa()
      })
      .then(res => {
        loading.dismiss()
      })
      .catch(err => {
        loading.dismiss()

        if (err.code === 'auth/wrong-password') {
          this.alertCtrl.create({
            title: 'Alerta',
            message: 'La contraseña no es correcta o el usuario no existe',
            buttons: ['Ok']
          }).present()
        }

        console.error('Error login - pages/login.ts', err)
        Raven.captureException(
          new Error(`Error login - pages/login.ts 🐛: ${JSON.stringify(err)}`),
          {
            extra: err
          }
        )
      })
  }

  private launchSignup (): void {
    this.navCtrl.push('SignupPage')
  }

  private requestNewPass (): void {
    const prompt = this.alertCtrl.create({
      title: 'Recuperar contraseña',
      message: 'Ingrese su correo electrónico, le enviaremos un link con el que podrá restablecer su contraseña',
      inputs: [
        {
          name: 'correo',
          placeholder: 'ejemplo@gmail.com'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Enviar',
          handler: data => {
            console.log(data)
            if (data.correo) {
              this.authServ.recoverPass(data.correo).then(res => {
                console.log('respuesta al recuperar pass', res)
              }).catch(err => console.error('Error al enviar el correo para restablecer la contraseña - pages/login.ts', err))
            }
          }
        }
      ]
    })
    prompt.present()
  }
}
