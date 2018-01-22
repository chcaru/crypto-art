import { Component, ElementRef, ViewChild } from '@angular/core';

import { EvoArt, GeneticTexture, renderEvoArt, generateRandomEvoArt, prettyPrint } from './../shared/services/render';

const rr = Math.random();
console.log(rr);

const testEvoArt: EvoArt = {
    // randomSeed: 0.10743071034134322,
    // randomSeed: 0.8749907780955624,
    // randomSeed: 0.08404043122280003,
    // randomSeed: 0.668498006670335,
    // randomSeed: 0.29440787532464996,
    // randomSeed: 0.2912949809518597,
    // randomSeed: 0.2531177940859146,
    // randomSeed: 0.25778903296424893,
    // randomSeed: 0.6300727200923126,
    // randomSeed: 0.48709250419390915,
    // randomSeed: 0.8115653593629433,
    // randomSeed: 0.04641879573128804,
    // randomSeed: 0.23501154853922235,
    // randomSeed: 0.0011663862123056923,
    // randomSeed: 0.13245597201370352,
    // randomSeed: 0.9496387914608209,
    // randomSeed: 0.8325282664212172,
    randomSeed: rr,
    // root: {
    //     texture: GeneticTexture.Filter,
    //     args: [
    //         {
    //             texture: GeneticTexture.Mult,
    //             args: [
    //                 {
    //                     // texture: GeneticTexture.Blur,
    //                     // args: [
    //                     //     {
    //                             texture: GeneticTexture.Ifs,
    //                             args: [],
    //                     //     },
    //                     // ],
    //                 },
    //                 {
    //                     texture: GeneticTexture.Grad,
    //                     args: [
    //                         {
    //                             texture: GeneticTexture.Color,
    //                             args: [{
    //                                 r: 65 / 255,
    //                                 g: 126 / 255,
    //                                 b: 231 / 255,
    //                             }],
    //                         },
    //                         {
    //                             texture: GeneticTexture.Color,
    //                             args: [{
    //                                 r: 234 / 255,
    //                                 g: 15 / 255,
    //                                 b: 93 / 255,
    //                             }],
    //                         },
    //                     ],
    //                 },
    //             ],
    //         },
    //     ],
    // },
    root: {
        texture: GeneticTexture.CCFXAA,
        args: [
            // {
            //     texture: GeneticTexture.Const,
            //     args: [Math.random()]
            // },
            {
                texture: GeneticTexture.PerlinParticlesRGB2,
                args: [
                    {
                        texture: GeneticTexture.Color,
                        args: [{
                            r: 65 / 255,
                            g: 126 / 255,
                            b: 231 / 255,
                        }],
                    },
                    {
                        texture: GeneticTexture.Color,
                        args: [{
                            r: 234 / 255,
                            g: 15 / 255,
                            b: 93 / 255,
                        }],
                    },
                ],
            },
        ],
    }
};

// {
//     "randomSeed": 0.6571947488756478,
//     "root": {
//       "texture": 23,
//       "args": [
//         {
//           "texture": 28,
//           "args": []
//         }
//       ]
//     }
//   }

// const testEvoArt: EvoArt = {
//     randomSeed: 1337,
//     root: 
//     {
//         texture: GeneticTexture.Blur,
//         args: [
//             {
//                 texture: GeneticTexture.Add,
//                 args: [
//                     {
//                         texture: GeneticTexture.Add,
//                         args: [
//                             {
//                                 texture: GeneticTexture.Grad,
//                                 args: [
//                                     {
//                                         texture: GeneticTexture.Color,
//                                         args: [{
//                                             r: 65 / 255,
//                                             g: 126 / 255,
//                                             b: 231 / 255,
//                                         }],
//                                     },
//                                     {
//                                         texture: GeneticTexture.Color,
//                                         args: [{
//                                             r: 234 / 255,
//                                             g: 15 / 255,
//                                             b: 93 / 255,
//                                         }],
//                                     },
//                                 ],
//                             },
//                             {
//                                 texture: GeneticTexture.Y,
//                                 args: [],
//                             },
//                         ],
//                     },
//                     {
//                         texture: GeneticTexture.Cos,
//                         args: [
//                             {
//                                 texture: GeneticTexture.Mult,
//                                 args: [
//                                     {
//                                         texture: GeneticTexture.X,
//                                         args: [],
//                                     },
//                                     {
//                                         texture: GeneticTexture.Y,
//                                         args: [],
//                                     },
//                                 ],
//                             },
//                         ],
//                     }
//                 ],
//             }
//         ],
//     },
// };

// Implement generic filter operator w/ random weights // DONE
// Implement classic filters
// FXAA
// Implement random blotches of color
// Simplify everything to work only with Views, except for things that require non-views?
// Represent image as genetically derived equation
// How to represent it in Solidity?
// Cross breeding - cheaper
// Bid to generate a new one, with customized probabilities for functions

const savedEvoArtKey = 'savedEvoArt';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
})
export class AppComponent {

    public savedArt: EvoArt[] = [];

    public evoArt: EvoArt = generateRandomEvoArt(5);

    public evoArtTree: string = JSON.stringify(this.evoArt, null, 2);

    public evoArtPrettyPrint = prettyPrint(this.evoArt.root);

    public ngAfterViewInit(): void {

        const art = JSON.parse(localStorage.getItem(savedEvoArtKey) || '[]');
        let i = 0;
        const addOne = () => setTimeout(() => {
            this.savedArt.push(art[i++]);

            if (i < art.length) {
                addOne();
            }
        });

        addOne();
    }

    public onSelect(art: EvoArt): void {

        this.evoArt = art;
        this.evoArtTree = JSON.stringify(art, null, 2);
        this.evoArtPrettyPrint = prettyPrint(art.root);
    }

    public onDelete(index: number): void {

        this.savedArt.splice(index, 1);
        localStorage.setItem(savedEvoArtKey, JSON.stringify(this.savedArt));
    }

    public onSave(): void {

        this.savedArt.push(this.evoArt);
        localStorage.setItem(savedEvoArtKey, JSON.stringify(this.savedArt));
    }

    public onNew(): void {

        this.onSelect(generateRandomEvoArt(20));
    }
}
