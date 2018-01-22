import { Component, Input, ViewChild, ElementRef } from "@angular/core";
import { EvoArt, renderEvoArt } from "../../services/render";

@Component({
    selector: 'evo-art',
    styleUrls: ['./evo-art.component.scss'],
    templateUrl: './evo-art.component.html',
})
export class EvoArtComponent {

    @Input()
    public width: number;

    @Input()
    public height: number;

    @Input()
    public evoArt: EvoArt;

    @ViewChild('canvas')
    public canvas: ElementRef;

    public ngAfterViewInit(): void {
        this.ngOnChanges();
    }

    public ngOnChanges(): void {

        const context = this.canvas.nativeElement.getContext('2d') as CanvasRenderingContext2D;
        
        renderEvoArt(context, this.evoArt, +this.width, +this.height);
    }
}