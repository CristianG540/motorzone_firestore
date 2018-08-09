import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Subscription } from 'rxjs'

import { BackgroundGeolocation, BackgroundGeolocationConfig, BackgroundGeolocationResponse } from '@ionic-native/background-geolocation'
import { Geolocation, GeolocationOptions, Geoposition } from '@ionic-native/geolocation'
import { Diagnostic } from '@ionic-native/diagnostic'
import { LocationAccuracy } from '@ionic-native/location-accuracy'

// AngularFire - Firestore
import { AngularFirestore, AngularFirestoreDocument, AngularFirestoreCollection } from 'angularfire2/firestore'

// Libs terceros
import _ from 'lodash'

// Providers
import { AuthProvider } from '../auth/auth'

@Injectable()
export class GeolocationProvider {

  private _isGpsEnabled: boolean
  private _coords: Coordinates
  public liveCoords: any
  public watchPosition: Subscription
  private liveCoordinatesCollectionRef: AngularFirestoreCollection<any>
  private _lastUpdateTime: Date

  constructor (
    private geolocation: Geolocation,
    private diagnostic: Diagnostic,
    private locationAccuracy: LocationAccuracy,
    private backgroundGeolocation: BackgroundGeolocation,
    private angularFirestoreDB: AngularFirestore,
    private authServ: AuthProvider
  ) {}

  public async getCurrentPosition (): Promise<Coordinates> {
    const geoLocOpts: GeolocationOptions = {
      maximumAge: 3000,
      timeout: 20000,
      enableHighAccuracy : true
    }
    this._isGpsEnabled = await this.diagnostic.isGpsLocationEnabled()
    if (this._isGpsEnabled) {

      const geoRes = await this.geolocation.getCurrentPosition(geoLocOpts)
      this._coords = geoRes.coords

      if (this._coords.accuracy > 50) {
        throw new Error('Por favor active el wifi y los datos antes de marcar la ubicacion.')
      }

      return this._coords

    } else {
      const res = await this._askForTurnOnGps()
      if (_.has(res, 'code') && res.code === 1) {

        const geoRes = await this.geolocation.getCurrentPosition(geoLocOpts)
        this._coords = geoRes.coords
        return this._coords

      } else {
        throw new Error(`Error inesperado al recuperar la posicion: ${JSON.stringify(res)}`)
      }
    }

  }

  private async _askForTurnOnGps (): Promise<any> {
    const canRequest: boolean = await this.locationAccuracy.canRequest()
    if (canRequest) {
      const res = await this.locationAccuracy.request(this.locationAccuracy.REQUEST_PRIORITY_HIGH_ACCURACY)
      return res
    } else {
      throw new Error('No se pudo obtener la unicacion, puede que el gps este apagado')
    }
  }

  public startTracking (): void {
    // Background Tracking

    this.liveCoordinatesCollectionRef = this.angularFirestoreDB.collection(`users/`).doc(this.authServ.userData.uid).collection('liveCoordinates')

    const config: BackgroundGeolocationConfig = {
      desiredAccuracy: 10,
      stationaryRadius: 20,
      distanceFilter: 10,
      debug: true,
      interval: 60000,
      stopOnTerminate: false,
      locationProvider: 1,
      startForeground: true
    }

    this.backgroundGeolocation.configure(config).subscribe((location: BackgroundGeolocationResponse) => {

      console.log('BackgroundGeolocation:  ' + location.latitude + ',' + location.longitude)

      this.liveCoords = {
        accuracy: location.accuracy || '',
        latitude: location.latitude || '',
        longitude: location.longitude || '',
        altitude: location.altitude || '',
        speed: location.speed || '',
        timestamp: location.timestamp || ''
      }

      const liveCoordsDoc: AngularFirestoreDocument<any> = this.liveCoordinatesCollectionRef.doc<any>(String(location.timestamp))

      liveCoordsDoc.set(this.liveCoords).catch(err => {
        console.error('Error subscribe "set coordinate firestore" - startTracking() - /providers/geolocation', err)
      })

    }, (err) => {

      console.error('Error subscribe "backgroundGeolocation" - startTracking() - /providers/geolocation', err)

    })

  // Turn ON the background-geolocation system.
    this.backgroundGeolocation.start()

  // Foreground Tracking

    let options = {
      frequency: 60000,
      enableHighAccuracy: true
    }

    this.watchPosition = this.geolocation.watchPosition(options).filter((p: any) => p.code === undefined).subscribe((position: Geoposition) => {
      const now = new Date()
      if (this._lastUpdateTime && now.getTime() - this._lastUpdateTime.getTime() < options.frequency) {
        console.log('Ignoring position update')
      } else {
        console.log('track geolocation simple', position)
        this.liveCoords = {
          accuracy: position.coords.accuracy || '',
          latitude: position.coords.latitude || '',
          longitude: position.coords.longitude || '',
          altitude: position.coords.altitude || '',
          speed: position.coords.speed || '',
          timestamp: position.timestamp || ''
        }
        const liveCoordsDoc: AngularFirestoreDocument<any> = this.liveCoordinatesCollectionRef.doc<any>(String(position.timestamp))
        liveCoordsDoc.set(this.liveCoords).catch(err => {
          console.error('Error subscribe "watchPosition set coordinate firestore" - startTracking() - /providers/geolocation', err)
        })
        this._lastUpdateTime = now
      }

    }, err => console.error('Error "watchPosition" - startTracking() - /providers/geolocation', err))

  }

  public stopTracking (): void {
    if (this.watchPosition) {
      try {
        console.log('stopTracking')
        this.backgroundGeolocation.stop()
        this.watchPosition.unsubscribe()
      } catch (err) {
        console.error('Error "stopTracking" - stopTracking() - /providers/geolocation', err)
      }
    }
  }

}
