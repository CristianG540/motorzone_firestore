import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { MarcasPage } from './marcas';

@NgModule({
  declarations: [
    MarcasPage,
  ],
  imports: [
    IonicPageModule.forChild(MarcasPage),
  ],
})
export class MarcasPageModule {}
