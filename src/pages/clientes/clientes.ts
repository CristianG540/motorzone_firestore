import { Component } from '@angular/core';
import { NavController, NavParams } from 'ionic-angular';

// Pages
import { CarteraPage } from '../cartera/cartera';

@Component({
  selector: 'page-clientes',
  templateUrl: 'clientes.html',
})
export class ClientesPage {

  private carteraPage = CarteraPage;
  private searchClientPage = 'ClienteModalPage';

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
  ) {
  }

}
