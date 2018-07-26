import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams, ToastController, MenuController } from 'ionic-angular';

// libs terceros
import Raven from 'raven-js';

// Providers
import { ProductosProvider } from '../../providers/productos/productos';
import { ConfigProvider } from '../../providers/config/config';
import { AuthProvider } from '../../providers/auth/auth';
import { CarritoProvider } from '../../providers/carrito/carrito';

// Models
import { Producto } from '../../providers/productos/models/producto';

@IonicPage()
@Component({
  selector: 'page-buscar',
  templateUrl: 'buscar.html',
})
export class BuscarPage {

  private autocompleteItems = [];
  private productoPage = 'ProductoPage';

  constructor(
    private navCtrl: NavController,
    private menuCtrl: MenuController,
    private navParams: NavParams,
    private prodsServ: ProductosProvider,
    private authServ:  AuthProvider,
    private cartService: CarritoProvider,
    private util: ConfigProvider,
  ) {
    this.menuCtrl.enable(true);
    this.prodsServ.init();
  }

  private updateSearch(ev: any): void {
    const loading = this.util.showLoading();
    // set val to the value of the searchbar
    const val = ev.target.value ? ev.target.value : '';
    if (val === '') {
      loading.dismiss();
      this.autocompleteItems = [];
      return;
    }
    this.prodsServ.searchAutocomplete(val)
      .then( (prods: Producto[]) => {
        loading.dismiss();
        this.autocompleteItems = prods;
      }).catch( err => {
        console.error('Error updateSearch - pages/buscar.ts', err);
        Raven.captureException( new Error(`Error updateSearch - pages/buscar.ts 🐛: ${JSON.stringify(err)}`), {
          extra: err,
        });
      })
  }

  private addProd(producto: Producto): void {

    this.util.promptAlertCant(d => {

      if ( d.txtCantidad && producto.existencias >= d.txtCantidad ) {

        const loading = this.util.showLoading();
        this.cartService.pushItem({
          _id: producto._id,
          cantidad: d.txtCantidad,
          totalPrice: producto.precio * d.txtCantidad,
          titulo: producto.titulo,
        }).then(res => {
          loading.dismiss();
          this.util.showToast(`El producto ${res.id} se agrego correctamente`);
        }).catch(err => {

          if ( err === 'duplicate') {
            loading.dismiss();
            this.util.showToast(`El producto ya esta en el carrito`);
          } else if (err === 'no_timsum_llantas') {
            loading.dismiss();
            this.util.showToast(`No puede agregar llantas timsum a este pedido`);
          } else if (err === 'timsum_llantas') {
            loading.dismiss();
            this.util.showToast(`Solo puede agregar llantas timsum a este pedido`);
          } else {
            loading.dismiss();
            console.error('error addProd - buscar.ts - page', err);
            Raven.captureException( new Error(`error addProd - buscar.ts - page 🐛: ${JSON.stringify(err)}`), {
              extra: err,
            });
          }

        });
      } else {
        this.util.showToast(`Hay ${producto.existencias} productos, ingrese una cantidad valida.`);
        return false;
      }

    });

  }

}
