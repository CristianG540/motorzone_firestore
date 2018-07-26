import { Component } from '@angular/core';
import { IonicPage, NavController } from 'ionic-angular';

// Pages
import { HomePage } from '../home/home';
import { ClientesPage } from '../clientes/clientes';
import { CarteraPage } from '../cartera/cartera';

// Providers
import { AuthProvider } from '../../providers/auth/auth';
import { CarritoProvider } from '../../providers/carrito/carrito';

@IonicPage()
@Component({
  selector: 'page-tabs',
  templateUrl: 'tabs.html',
})
export class TabsPage {

  inicioRoot = HomePage;
  marcasRoot = 'MarcasPage';
  carritoRoot = 'CarritoPage';
  clientesRoot = ClientesPage;
  ordenesRoot = 'OrdenesPage';
  buscarRoot = 'BuscarPage';
  carteraRoot = CarteraPage;

  constructor(
    private cartService: CarritoProvider,
    private authServ: AuthProvider,
  ) {
  }

  public get itemsCart(): number {
    return this.cartService.carItems.length;
  }

}
