import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { ClienteModalPage } from './cliente-modal';

@NgModule({
  declarations: [
    ClienteModalPage,
  ],
  imports: [
    IonicPageModule.forChild(ClienteModalPage),
  ],
})
export class ClienteModalPageModule {}
