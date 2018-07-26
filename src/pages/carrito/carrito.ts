import { Component } from '@angular/core';
import { IonicPage, Events, AlertController } from 'ionic-angular';

// libs terceros
import Raven from 'raven-js';

// Models
import { Producto } from '../../providers/productos/models/producto';

// Providers
import { CarritoProvider } from '../../providers/carrito/carrito';
import { ProductosProvider } from '../../providers/productos/productos';
import { ConfigProvider } from '../../providers/config/config';

@IonicPage()
@Component({
  selector: 'page-carrito',
  templateUrl: 'carrito.html',
})
export class CarritoPage {

  private _prods: Producto[] = [];
  // Pages
  private confirmarOrdenPage: string = 'ConfirmarOrdenPage';
  private productoPage: string = 'ProductoPage';

  constructor(
    private alertCtrl: AlertController,
    private evts: Events,
    private cartServ: CarritoProvider,
    private prodServ: ProductosProvider,
    private util: ConfigProvider,
  ) {
    this.evts.subscribe('cart:change', () => {
      this.reloadProds();
      console.log('se lanzo el evento change');
    });
  }

  ionViewDidEnter() {
    this.reloadProds();
  }

  private reloadProds(): void {
    const prodsId = this.cartServ.carIdItems;
    this.prodServ.fetchProdsByids(prodsId)
      .then((prods: Producto[]) => {
        this._prods = prods.filter(Boolean);
        console.log('prods carrito', this._prods);
      })
      .catch(err => {
        console.error('Error reloadProds pages/carrito.ts', err);
        Raven.captureException( new Error(`Error reloadProds pages/carrito.ts 🐛: ${JSON.stringify(err)}`), {
          extra: err,
        });
      });
  }

  private deleteItem(prod: Producto): void {
    const loading = this.util.showLoading();
    this.cartServ.deleteItem(prod)
      .then(res => {
        loading.dismiss();
        this.util.showToast(`El producto ${res.id} se elimino de carrito correctamente`);
        console.log('prod eliminado carrito', res);
      })
      .catch(err => {
        loading.dismiss();
        console.error('Error deleteItem pages/carrito.ts', err);
        Raven.captureException( new Error(`Error deleteItem pages/carrito.ts 🐛: ${JSON.stringify(err)}`), {
          extra: err,
        });
      });
  }

  private deleteDb(): void {

    this.alertCtrl.create({
      title: 'Esta seguro de borrar todo el carrito ?',
      enableBackdropDismiss: false,
      buttons: [
        {
          text: 'No',
          role: 'cancel',
        },
        {
          text: 'Si',
          handler: () => {
            this.cartServ.destroyDB(true)
              .catch(err => {
                console.error('error deleteDB pages/carrito.ts', err);
                Raven.captureException( new Error(`error deleteDB pages/carrito.ts 🐛: ${JSON.stringify(err)}`), {
                  extra: err,
                });
              });
          },
        },
      ],
    }).present();

  }

  private trackByProds(index: number, prod: Producto): string {
    return prod._id;
  }

}
