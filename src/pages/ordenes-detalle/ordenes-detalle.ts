import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';

// libs terceros
import _ from 'lodash';
import Raven from 'raven-js';

// Models
import { Producto } from '../../providers/productos/models/producto';
import { CarItem } from '../../providers/carrito/models/carItem';

// Providers
import { ProductosProvider } from '../../providers/productos/productos';
import { ConfigProvider as cg} from '../../providers/config/config';

@IonicPage()
@Component({
  selector: 'page-ordenes-detalle',
  templateUrl: 'ordenes-detalle.html',
})
export class OrdenesDetallePage {

  private _prods: any = [];
  private _itemsOrder: CarItem[] = [];
  private _cliente: string;
  private _error: string;

  constructor(
    private navParams: NavParams,
    private prodServ: ProductosProvider,
    private util: cg,
  ) {
  }

  ionViewDidLoad() {
    const loading = this.util.showLoading();
    // console.log('ionViewDidLoad OrdenesDetallePage', this.navParams.data);
    this._itemsOrder = this.navParams.data.items;
    this._cliente = (this.navParams.data.nitCliente) ? this.navParams.data.nitCliente : this.navParams.data.newClient.codCliente;
    this._error = this.navParams.data.error;
    const prodsId = _.map(this._itemsOrder, '_id');

    this.prodServ.fetchProdsByids(prodsId)
      .then((prods: Producto[]) => {
        prods = prods.filter(Boolean);
        this._prods = _.map(prods, (prod: Producto) => {
          const itemId = cg.binarySearch(this._itemsOrder, '_id', prod._id);
          return {
            _id    : prod._id,
            titulo : prod.titulo,
            imagen : prod.imagen,
            cant   : this._itemsOrder[itemId].cantidad,
            total  : this._itemsOrder[itemId].totalPrice,
          };
        });
        loading.dismiss();
      })
      .catch(err => {
        console.error('Error ionViewDidLoad pages/ordenes-detalle.ts', err);
        Raven.captureException( new Error(`Error ionViewDidLoad pages/ordenes-detalle.ts 🐛: ${JSON.stringify(err)}`), {
          extra: err,
        });
      });
  }

}
