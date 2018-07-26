import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { timeout } from 'rxjs/operators';

// libs terceros
import Raven from 'raven-js';

// Providers
import { ConfigProvider as cg } from '../config/config';
import { AuthProvider } from '../../providers/auth/auth';

@Injectable()
export class CarteraProvider {

  constructor(
    private http: HttpClient,
    private storage: Storage,
    private authServ: AuthProvider,
  ) {}

  /**
   * Esta funcion se encarga de buscar la cartera del cliente, segun el asesor
   * actualmente logueado en la app, los busca por el NIT del cliente
   * con el motor de busqueda lucene de cloudant, este metodo tambien hace
   * uso del api async/await de ecmascript 7 si no estoy mal
   *
   * @param {string} nitCliente
   * @returns {Promise<any>}
   * @memberof CarteraProvider
   */
  public async searchCartera(nitCliente: string): Promise<any> {
    try {
      const token = await this.storage.get('josefa-token');
      /**
       * Bueno aqui hago todo lo contrario a lo que hago con los productos
       * en vez de hacer un offline first (que deberia ser lo correcto)
       * hago un online first por asi decirlo, lo que hago es buscar primero
       * en cloudant/couchdb por los clientes, si por algun motivo no los puedo
       * traer digace fallo de conexion o lo que sea, entonces busco los clientes
       * en la base de datos local
       */
      const url: string = cg.JOSEFA_URL + '/sap/cartera';
      const options = {
        headers: new HttpHeaders({
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        }),
      };
      const body: string = JSON.stringify({
        and: {
          codCliente: nitCliente,
          codVendedor: this.authServ.userData.idAsesor,
        },
      });

      /**
       * aqui haciendo uso del async/await hago un try/catch que primero
       * intenta traer los datos mediante http de cloudant, si por algun motivo
       * la petcion falla entonces el catch se encarga de buscar los clientes
       * en la bd local
       */

      const res = await this.http
        .post(url, body, options)
        .pipe(timeout(7000))
        .toPromise();

      return res;
    } catch (err) {
      console.error('Error searchCartera - providers/cartera.ts', err);
      Raven.captureException( new Error(`Error searchCartera - providers/cartera.ts 🐛: ${JSON.stringify(err)}`), {
        extra: err,
      });
      throw new Error(
        'Error en cartera debido a un fallo con la conexion, verifique los datos o busque una red wifi: ' +
          JSON.stringify(err),
      );
    }
  }
}
