import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams, ModalController, AlertController } from 'ionic-angular';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';

// Libs terceros
import _ from 'lodash';
import Raven from 'raven-js';

// Models
import { CarItem } from '../../providers/carrito/models/carItem';
import { Orden } from '../../providers/orden/models/orden';

// Providers
import { CarritoProvider } from '../../providers/carrito/carrito';
import { ClientesProvider } from '../../providers/clientes/clientes';
import { ConfigProvider as cg } from '../../providers/config/config';
import { AuthProvider } from '../../providers/auth/auth';
import { GeolocationProvider } from '../../providers/geolocation/geolocation';
import { OrdenProvider } from '../../providers/orden/orden';
import { ProductosProvider } from '../../providers/productos/productos';

@IonicPage()
@Component({
  selector: 'page-confirmar-orden',
  templateUrl: 'confirmar-orden.html',
})
export class ConfirmarOrdenPage {

  private ordenForm: FormGroup;
  private newClient: FormGroup;
  private newClientFlag: boolean = false;
  private transportadora: number;

  constructor(
    private authServ: AuthProvider,
    private cartServ: CarritoProvider,
    private ordenServ: OrdenProvider,
    private prodServ: ProductosProvider,
    private geolocation: GeolocationProvider,
    private util: cg,
    private fb: FormBuilder,
    private navCtrl: NavController,
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
  ) {
  }

  // Runs when the page is about to enter and become the active page.
  ionViewWillLoad() {
    this.initializeForm();
  }

  private initializeForm(): void {

    this.ordenForm = this.fb.group({
      observaciones: [''],
      cliente: [this.authServ.userData.nitCliente, Validators.required],
    });

    if ( this.authServ.userData.transportadora ) {
      this.transportadora = this.authServ.userData.transportadora;
    }

    if ( this.authServ.userData.nitCliente ) {

      this.ordenForm = this.fb.group({
        observaciones: [''],
        cliente: ['C' + this.authServ.userData.nitCliente, Validators.required],
      });
    } else {

      this.ordenForm = this.fb.group({
        observaciones: [''],
        cliente: [this.authServ.userData.nitCliente, Validators.required],
      });
    }

    this.newClient = this.fb.group({
      nombre: ['', Validators.required],
      codCliente: ['', Validators.required],
    });
  }

  private showClientModal(): void {
    const modal = this.modalCtrl.create('ClienteModalPage');
    modal.onDidDismiss(data => {
      if (data) {
        this.ordenForm.controls['cliente'].setValue(data.nit);
        this.transportadora = data.transp;
      }
    });
    modal.present();
  }

  private onSubmit(): void {
    const loading = this.util.showLoading();

    // get current position
    this.geolocation.getCurrentPosition().then(pos => {

      this.procesarOrden({
        lat: pos.latitude,
        lon: pos.longitude,
        accuracy: pos.accuracy,
      });
      loading.dismiss();
    }).catch( (err) => {

      loading.dismiss();
      console.error('error onSubmit pages/confirmar-orden.ts', err);
      Raven.captureException( new Error(`error onSubmit pages/confirmar-orden.ts 🐛: ${JSON.stringify(err)}`), {
        extra: err,
      });
      if (_.has(err, 'code') && err.code === 4 || err.code === 1) {
        this.alertCtrl.create({
          title: 'Error.',
          message: 'Por favor habilite el uso del gps, para poder marcar la posicion del pedido',
          buttons: ['Ok'],
        }).present();

      } else {
        this.procesarOrden();
        console.error('GPS- onSubmit confirmar_orden.ts - Error al marcar la posicion de pedido 😫: ' + err);
      }
    });

  }

  /**
   * Se encarga de procesar la orden, enviarla a sap, guardarla en el registro en mysql
   * y guardarla en CouchDB
   *
   * @private
   * @param {any} [position=""] Recibe un objeto con la latitud, longitud y presicion sacada de la
   * posicion gps del celular, si no se ingresa el objeto el default es un objeto vacio
   * {
   *    lat: 213,
   *    lon: 321,
   *    accuracy : 20
   * }
   * @memberof ConfirmarOrdenPage
   */
  private procesarOrden(position: any = ''): void {

    const loading = this.util.showLoading();
    /**
     * recupero los items del carrito para guardarlos en la orden
     */
    const carItems: CarItem[] = this.cartServ.carItems;
    let orden: Orden;
    const observaciones = this.ordenForm.get('observaciones').value;
    /**
     * Si el cliente no es nuevo ya sea porque se sabia el nit y lo
     * ingreso manualmente o desde el buscador de clientes entonces recupero
     * la info desde el form de estandar y se la asigno a la orden
     */
    if (!this.newClientFlag && this.ordenForm.valid) {

      const form = JSON.parse(JSON.stringify(this.ordenForm.value));
      orden = {
        _id : Date.now().toString(),
        nitCliente: form.cliente,
        observaciones: observaciones,
        items: carItems,
        total: this.cartServ.totalPrice,
        transp: this.transportadora,
        estado: false,
        type: 'orden',
        location: {
          lat : position.lat ? position.lat : '',
          lon : position.lon ? position.lon : '',
        },
        accuracy: position.accuracy ? position.accuracy : '',
      };
    }
    /**
     * Si le dio click a la opcion de nuevo cliente entonces oculto el buscador de clientes
     * y se despliega le formulario para clientes nuevos, que pide el nombre y el nit
     * recupero los datos y se los asigno a la orden
     */
    if (this.newClientFlag && this.newClient.valid) {

      const form = JSON.parse(JSON.stringify(this.newClient.value));
      orden = {
        _id : Date.now().toString(),
        newClient : form,
        nitCliente: form.codCliente ? form.codCliente : '',
        observaciones: observaciones,
        items: carItems,
        total: this.cartServ.totalPrice,
        estado: false,
        type: 'orden',
        location: {
          lat : position.lat ? position.lat : '',
          lon : position.lon ? position.lon : '',
        },
        accuracy: position.accuracy ? position.accuracy : '',
      };
    }

    /**
     * Guardo la orden en la base de datos
     */
    this.ordenServ.pushItem(orden)
      .then(res => {
        // Actualizo la cantidad de los productos que se ordenaron
        return this.prodServ.updateQuantity(carItems);
      })
      .then(res => {
        /** Vacio el carrito y envio el usuario al tab de ordenes */
        this.cartServ.destroyDB(true);
        this.navCtrl.popToRoot();
        this.navCtrl.parent.select(5);
        /** *** *** *** *** *** *** *** *** *** *** *** *** ***   */

        loading.dismiss();

        return this.ordenServ.sendOrdersSap();

      })
      .then( (responses: any) => {
        const failOrders = _.filter(responses.apiRes, (res: any) => {
          return res.responseApi.code >= 400;
        });
        if (failOrders.length > 0) {
          this.alertCtrl.create({
            title: 'Advertencia.',
            message: failOrders.length + ' ordenes no se han podido subir a sap, verifique su conexion a internet y vuelva a intentarlo',
            buttons: ['Ok'],
          }).present();
        } else {
          this.alertCtrl.create({
            title: 'Info.',
            message: 'Las ordenes se subieron correctamente a sap.',
            buttons: ['Ok'],
          }).present();
        }
      })
      .catch(err => {
        console.error('Error procesarOrden pages/confirmar-orden.ts', err);
        Raven.captureException( new Error(`Error procesarOrden pages/confirmar-orden.ts 🐛: ${JSON.stringify(err)}`), {
          extra: err,
        });
      });
  }

  /**
   * este getter lo uso en la vista de este pagina, se encarga de informar
   * el estado de los datos de la orden por asi decirlo, debido a que
   * se usan dos forms diferentes uno si el cliente es nuevo y otro si el
   * cliente es viejo, entonces esto me devuelve el estado del formulario activo
   * y asi puedo deshabilitar el boton de finalizar la orden si el fomrulario activo
   * es invalido
   *
   * @readonly
   * @type {boolean}
   * @memberof ConfirmarOrdenPage
   */
  public get formStatus(): boolean {
    if (this.newClientFlag) {
      return this.newClient.valid;
    } else {
      return this.ordenForm.valid;
    }
  }

}
