import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';


import { AppComponent } from './app.component';
import { EvoArtComponent } from '../shared/components/evo-art/evo-art.component';


@NgModule({
  declarations: [
    AppComponent,
    EvoArtComponent,
  ],
  imports: [
    BrowserModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
