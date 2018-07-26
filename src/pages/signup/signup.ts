import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams, Loading, LoadingController, Config } from 'ionic-angular';
import { FormGroup, FormBuilder, Validators, AbstractControl, FormControl, ValidatorFn  } from '@angular/forms';

// libs terceros
import Raven from 'raven-js';

// Providers
import { AuthProvider } from '../../providers/auth/auth';
import { ConfigProvider } from '../../providers/config/config';

// Pages
import { HomePage } from '../../pages/home/home';

function passwordMatchValidator(g: FormGroup) {
  return g.get('password').value === g.get('passwordConfirm').value
    ? null : { 'mismatch': true };
}

@IonicPage()
@Component({
  selector: 'page-signup',
  templateUrl: 'signup.html',
})
export class SignupPage {

  private name: string;
  private username: string;
  private asesor_id: number;
  private nitCliente: string = '';
  private email: string;
  private password: string;
  private confirmPassword: string;

  private loading: Loading;
  private signupForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private navCtrl: NavController,
    private loadingCtrl: LoadingController,
    private navParams: NavParams,
    private cgServ: ConfigProvider,
    private authServ:  AuthProvider,
  ) {
  }

  // Runs when the page is about to enter and become the active page.
  ionViewWillLoad() {
    this.initializeForm();
  }

  private initializeForm(): void {
    this.signupForm = new FormGroup({
      name: new FormControl('', [Validators.required] ),
      username: new FormControl('', [Validators.required] ),
      asesor_id: new FormControl('', [Validators.required] ),
      nit_cliente: new FormControl(''),
      email: new FormControl('', [Validators.email, Validators.required] ),
      password: new FormControl(null, [Validators.required] ),
      passwordConfirm: new FormControl(null, [Validators.required]),
    }, passwordMatchValidator);
  }

  private register(): void {
    const loading = this.cgServ.showLoading();

    const formModel = JSON.parse(JSON.stringify(this.signupForm.value));

    this.authServ.register(formModel).then(() => {
      loading.dismiss();
      // this.navCtrl.setRoot(HomePage);
    }).catch(err => {
      loading.dismiss();
      console.error('error register - pages/signup.ts', err);
      Raven.captureException( new Error(`error register - pages/signup.ts 🐛: ${JSON.stringify(err)}`), {
        extra: err,
      });
    });

  }

  /*private register(): void {
    this.showLoading();
    let user = {
      name: this.name,
      username: this.username,
      email: this.email,
      profile: {
        asesor_id: this.asesor_id,
        email: this.email,
        nit_cliente: this.nitCliente
      },
      asesor_id: this.asesor_id,
      password: this.password,
      confirmPassword: this.confirmPassword
    };

    this.authService.register(user)
    .then(res=>{
      console.log(res);
      this.loading.dismiss();

      this.dbServ.init(res.userDBs.supertest, this.authService.userId).then( info => {
        console.warn('DbAverno- First Replication complete');
      }).catch( err => {
        console.error("DbAverno-totally unhandled error (shouldn't happen)", err);
        Raven.captureException( new Error(`DbAverno- Error en la bd local no deberia pasar 😫: ${JSON.stringify(err)}`), {
          extra: err
        } );
      });;

      this.navCtrl.setRoot('TabsPage');
    }).catch(err=>{
      console.log(err);
      this.loading.dismiss();
    })

  }

  private showLoading(): void {
    this.loading = this.loadingCtrl.create({
      content: 'Loading...'
    });
    this.loading.present();
  } */

}
