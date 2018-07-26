import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';

// Models
import { Orden } from '../../providers/orden/models/orden';

// Providers
import { OrdenProvider } from '../../providers/orden/orden';
import { ConfigProvider as cg } from '../../providers/config/config';

@IonicPage()
@Component({
  selector: 'page-ordenes',
  templateUrl: 'ordenes.html',
})
export class OrdenesPage {

  private appVer: string = cg.APP_VER;
  private ordenesDetallePage = 'OrdenesDetallePage';

  constructor(
    private navCtrl: NavController,
    private navParams: NavParams,
    private ordenServ: OrdenProvider,
  ) {
  }

  public iconOrden(orden: Orden): string {
    if (orden.estado === 'seen') {
      return 'eye';
    }
    if (orden.error) {
      return 'warning';
    }
    return (orden.estado) ? 'checkmark' : 'time';
  }

  private trackById(index: number, orden: Orden): string {
    return orden._id;
  }

}
