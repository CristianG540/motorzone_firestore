import { Component } from '@angular/core';
import { NavController, NavParams, ViewController } from 'ionic-angular';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';

// Libs terceros
import _ from 'lodash';
import * as moment from 'moment';
import Raven from 'raven-js';

// Providers
import { CarteraProvider } from '../../providers/cartera/cartera';
import { ConfigProvider as cg} from '../../providers/config/config';
import { AuthProvider } from '../../providers/auth/auth';

// Models
import { Cartera } from '../../providers/cartera/models/cartera_mdl';

@Component({
  selector: 'page-cartera',
  templateUrl: 'cartera.html',
})
export class CarteraPage {

  private carteraItems: Cartera[] = [];
  private searchForm: FormGroup;
  private totalCliente: number = 0;
  private loading: boolean = false;

  constructor(
    public viewCtrl: ViewController,
    private navCtrl: NavController,
    private navParams: NavParams,
    private fb: FormBuilder,
    private carteraServ: CarteraProvider,
    private authServ: AuthProvider,
  ) {
  }

  ionViewWillLoad() {
    this.initializeForm();
  }

  private initializeForm(): void {
    if (this.navParams.get('_id')) {
      this.searchForm = this.fb.group({
        cliente: [this.navParams.get('_id'), Validators.required],
      });
      this.onSubmit();
    } else {
      this.searchForm = this.fb.group({
        cliente: ['C' + this.authServ.userData.nitCliente, Validators.required],
      });
    }
    if (this.authServ.userData.nitCliente) {
      this.onSubmit();
    }

  }

  private onSubmit(): void {
    const form = JSON.parse(JSON.stringify(this.searchForm.value));

    if (form.cliente) {
      this.totalCliente = 0;
      this.loading = true;
      this.carteraServ.searchCartera(form.cliente).then(res => {
        this.loading = false;

        this.carteraItems = _.chain(res.data)
          .map((row: any): Cartera => {
            this.totalCliente += parseInt(row.valor, 10);
            row.valor = parseInt(row.valor, 10);
            row.valor_total = parseInt(row.valor_total, 10);
            row.fecha_emision = moment(row.fecha_emision).format('YYYY-MM-DD');
            row.fecha_vencimiento = moment(row.fecha_vencimiento).format('YYYY-MM-DD');
            return row;
          })
          .orderBy(['fecha_emision'], ['asc'])
          .value();

      }).catch( err => {
        this.loading = false;
        console.error('Error onSubmit pages/cartera.ts', err);
        Raven.captureException( new Error(`Error onSubmit pages/cartera.ts 🐛: ${JSON.stringify(err)}`), {
          extra: err,
        });
      });
    }

  }

  private dismiss(): void {
    this.viewCtrl.dismiss();
  }

}
