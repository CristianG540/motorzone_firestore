import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, timeout } from 'rxjs/operators';

// Libs terceros
import _ from 'lodash';
import PouchDB from 'pouchdb';
import PouchUpsert from 'pouchdb-upsert';
import Raven from 'raven-js';

// Models
import { Cliente } from './models/cliente';

// Providers
import { AuthProvider } from '../../providers/auth/auth';
import { ConfigProvider as cg } from '../../providers/config/config';

@Injectable()
export class ClientesProvider {

  private _remoteDB: any;

  constructor(
    private http: HttpClient,
    private authServ: AuthProvider,
  ) {
    PouchDB.plugin(PouchUpsert);
    // Base de datos remota en couchdb
    this._remoteDB = new PouchDB(cg.CDB_URL_CLIENTES, {
      auth: {
        username: cg.CDB_USER,
        password: cg.CDB_PASS,
      },
    });

  }

  /**
   * Esta funcion se encarga de buscar los clientes del asesor
   * actualmente logueado en la app, los busca por el nombre del cliente
   * con el motor de busqueda lucene de cloudant, este metodo tambien hace
   * uso del api async/await de ecmascript 7 si no estoy mal
   *
   * @param {string} query
   * @returns {Promise<any>}
   * @memberof ClientesProvider
   */
  public async searchCliente(query: string): Promise<any> {

    const url: string = cg.SEARCH_CLIENTS_URL;
    const params = new HttpParams()
      .set('keyword', query)
      .set('asesor', String(this.authServ.userData.idAsesor) );
    const options = {
      headers: new HttpHeaders({
        'Accept'       : 'application/json',
        'Content-Type' : 'application/json',
      }),
      params: params,
    };

    /**
     * aqui haciendo uso del async/await hago un try/catch que primero
     * intenta traer los datos mediante http de elsaticsearch, si por algun motivo
     * la petcion falla entonces el catch se encarga de buscar los clientes
     * en la bd local pouchdb
     */
    try {

      const res = await this.http.get( url, options ).pipe(
        map((response: any) => {
          return response;
        }),
        timeout(5000),
      ).toPromise();

      const data = { rows: res };

      return data;

    } catch (err) {
      console.error('Error searchCliente - providers/clientes.ts ', err);
      Raven.captureException( new Error(`Error searchCliente - providers/clientes.ts 🐛: ${JSON.stringify(err)}`), {
        extra: err,
      });
    }

  }

  /**
   * Esta funcion se encarga de actualizar la posicion geografica del cliente
   * de esta forma puedo mostrar la ubicacion del cliente en un mapa de gmaps
   *
   * @param {any} id
   * @param {number} lat
   * @param {number} long
   * @param {number} accuracy
   * @returns {Promise<any>}
   * @memberof ClientesProvider
   */
  public async updateLocation(id, lat: number, long: number, accuracy: number): Promise<any> {

    // El cliente que recibe el callback es cliente que esta actualmente en la bd/couchdb
    const res = await this._remoteDB.upsert(id, (cliente: Cliente) => {
      cliente.ubicacion = {
        latitud: lat,
        longitud: long,
        accuracy: accuracy,
      };
      cliente.updated_at = Date.now();
      return cliente;
    });

    return res;

  }

  public async getClientesByIds( ids: any[] ): Promise<any> {
    const res = await this._remoteDB.allDocs({
      include_docs : true,
      keys         : ids,
    });
    if (res && res.rows.length > 0) {
      return res.rows;
    } else {
      return [];
    }
  }

}
