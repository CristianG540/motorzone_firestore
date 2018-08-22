import { Injectable } from '@angular/core'
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http'
import { Storage } from '@ionic/storage'
import { Observable } from 'rxjs/Observable'
import { Events } from 'ionic-angular'
import 'rxjs/add/operator/switchMap'
import { map, timeout } from 'rxjs/operators'

// libs terceros
import Raven from 'raven-js'

// AngularFire - Firestore
import { AngularFireAuth } from 'angularfire2/auth'
import { AngularFirestore, AngularFirestoreDocument } from 'angularfire2/firestore'

// Models
import { User } from './model/user'

// Providers
import { ConfigProvider as cg } from '../config/config'

@Injectable()
export class AuthProvider {

  public userSession
  private _userRef: AngularFirestoreDocument<User>
  public userObservable: Observable<User>
  public userData: User
  public emailStatus: boolean = false // Me indica si el usuario ya verifico la cuenta

  constructor (
    private angularFireAuth: AngularFireAuth,
    private angularFirestoreDB: AngularFirestore,
    private util: cg,
    private evts: Events,
    private storage: Storage,
    private httpClient: HttpClient
  ) {
    this.userObservable = this.angularFireAuth.authState.switchMap(
      user => {
        if (user) {
          this.userSession = user
          this.emailStatus = user.emailVerified
          this._userRef = this.angularFirestoreDB.doc<User>(`users/${user.uid}`)
          /**
           * Hago el map aqui para evitar poner codigo fuera del provider
           * al momento de hacer el subscribe
           */
          return this._userRef.valueChanges().pipe(
            map((userDB: User) => {
              if (userDB && this.userSession) {
                this.userData = userDB
                this.sendEmailVerification(this.userSession)
              }
              return userDB
            })
          )
        } else {
          return Observable.of(null)
        }
      }
    )

  }

  private setUserData (data: User) {
    return this._userRef.set(data)
  }

  private updateUserData (data: any) {
    return this._userRef.update(data)
  }

  public register (d): Promise<any> {
    return this.angularFireAuth.auth.createUserWithEmailAndPassword(d.email, d.password).then(user => {

      this._userRef = this.angularFirestoreDB.doc<User>(`users/${user.uid}`)
      return this.setUserData({
        uid: user.uid,
        name: d.name,
        username: d.username,
        email: user.email,
        // idAsesor: d.asesor_id,
        nitCliente: d.nit_cliente,
        verificationEmailIsSend: false,
        bodega: '01'
      })

    })
  }

  public sendEmailVerification (user): void {

    if (!this.userData.verificationEmailIsSend) {

      user.sendEmailVerification()
      .then(() => {
        console.log('email verification sent')
        this.updateUserData({
          verificationEmailIsSend: true
        })
      }).catch(err => {
        console.error('Error sendEmailVerification- providers/auth.ts', err)
        Raven.captureException(new Error(`Error sendEmailVerification- providers/auth.ts 🐛: ${JSON.stringify(err)}`), {
          extra: err
        })
      })

    }

  }

  public changeWarehouse (): Promise<any> {
    return this.updateUserData({
      bodega: (this.userData.bodega === '01') ? '09' : '01'
    })
  }

  public login (email, password): Promise<any> {
    return this.angularFireAuth.auth.signInWithEmailAndPassword(email, password)
  }

  public logout (): Promise<any> {
    return this.removeTokenJosefa().then(res => {
      this.evts.publish('auth:logout', '')
      return this.angularFireAuth.auth.signOut()
    })
  }

  public async getTokenJosefa (): Promise<any> {
    const auth: string = 'Basic ' + btoa('admin:admin1234')
    const options = {
      headers: new HttpHeaders({
        'Accept'       : 'application/json',
        'Content-Type' : 'application/json',
        'Authorization': auth
      })
    }
    const url: string = cg.JOSEFA_URL + '/authenticate'

    const res = await this.httpClient.post<any>(url, '', options).pipe(
      timeout(7000)
    ).toPromise()

    return this.storage.set('josefa-token', res.data.token)

  }

  public removeTokenJosefa (): Promise<any> {
    return this.storage.remove('josefa-token')
  }

  public recoverPass (email: string): Promise<any> {
    return this.angularFireAuth.auth.sendPasswordResetEmail(email)
  }

}
