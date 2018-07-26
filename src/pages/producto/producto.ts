import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';

// libs terceros
import Raven from 'raven-js';

// Models
import { Producto } from '../../providers/productos/models/producto';

// Providers
import { ConfigProvider } from '../../providers/config/config';
import { CarritoProvider } from '../../providers/carrito/carrito';
import { AuthProvider } from '../../providers/auth/auth';

@IonicPage()
@Component({
  selector: 'page-producto',
  templateUrl: 'producto.html',
})
export class ProductoPage {

  private producto: Producto;

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private cartServ: CarritoProvider,
    private authServ:  AuthProvider,
    private util: ConfigProvider,
  ) {
    this.producto = this.navParams.data;
  }

  private addProd(): void {

    this.util.promptAlertCant(d => {
      if ( d.txtCantidad && this.producto.existencias >= d.txtCantidad ) {

        const loading = this.util.showLoading();
        this.cartServ.pushItem({
          _id: this.producto._id,
          cantidad: d.txtCantidad,
          totalPrice: this.producto.precio * d.txtCantidad,
          titulo: this.producto.titulo,
        }).then(res => {
          loading.dismiss();
          this.util.showToast(`El producto ${res.id} se agrego correctamente`);
          this.navCtrl.popToRoot();
        }).catch(err => {

          if (err === 'duplicate') {
            loading.dismiss();
            this.util.showToast(`El producto ya esta en el carrito`);
          } else if (err === 'no_timsum_llantas') {
            loading.dismiss();
            this.util.showToast(`No puede agregar llantas timsum a este pedido`);
          } else if (err === 'timsum_llantas') {
            loading.dismiss();
            this.util.showToast(`Solo puede agregar llantas timsum a este pedido`);
          } else {
            console.error('Error addProd pages/producto.ts', err);
            Raven.captureException( new Error(`Error addProd pages/producto.ts 🐛: ${JSON.stringify(err)}`), {
              extra: err,
            });
          }

        });

      } else {
        this.util.showToast(`Hay ${this.producto.existencias} productos, ingrese una cantidad valida.`);
        return false;
      }
    });

  }

}
