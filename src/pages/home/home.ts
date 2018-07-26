import { Component } from '@angular/core';
import { NavController, ActionSheetController, AlertController, Alert, MenuController } from 'ionic-angular';

import { SongProvider } from '../../providers/song/song';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html',
})
export class HomePage {

  constructor(
    private navCtrl: NavController,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
    private songServ: SongProvider,
    private menuCtrl: MenuController,
  ) {
    this.menuCtrl.enable(true);
    songServ.getAll();
  }

  private addSong(): void {
    const prompt = this.alertCtrl.create({
      title: 'Song Name',
      message: 'Enter a name for this new song you\'re so keen on adding',
      inputs: [
        {
          name: 'title',
          placeholder: 'Title',
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          handler: data => {
            console.log('Cancel clicked');
          },
        },
        {
          text: 'Save',
          handler: data => this.songServ.add(data),
        },
      ],
    });
    prompt.present();
  }

  private showOptions(songId, songTitle): void {
    const actionSheet = this.actionSheetCtrl.create({
      title: 'What do you want to do?',
      buttons: [
        {
          text: 'Delete Song',
          role: 'destructive',
          handler: () => {
            this.removeSong(songId);
          },
        }, {
          text: 'Update title',
          handler: () => {
            this.updateSong(songId, songTitle);
          },
        }, {
          text: 'Cancel',
          role: 'cancel',
          handler: () => {
            console.log('Cancel clicked');
          },
        },
      ],
    });
    actionSheet.present();
  }

  private removeSong(songId: string): void {
    this.songServ.remove(songId);
  }

  private updateSong(songId, songTitle): void {
    const prompt = this.alertCtrl.create({
      title: 'Song Name',
      message: 'Update the name for this song',
      inputs: [
        {
          name: 'title',
          placeholder: 'Title',
          value: songTitle,
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          handler: data => {
            console.log('Cancel clicked');
          },
        },
        {
          text: 'Save',
          handler: data => {
            this.songServ.update(songId, data);
          },
        },
      ],
    });
    prompt.present();
  }

}
