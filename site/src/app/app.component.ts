import { Component, ElementRef, ViewChild } from '@angular/core';
import 'seedrandom/seedrandom';
import { debug } from 'util';

export const enum GeneticTexture {
    X = 0,
    Y = 1,
    Color = 2,
    Const = 3,
    Add = 4,
    Sub = 5,
    Mult = 6,
    Div = 7,
    Pow = 8,
    Cos = 9,
    Sin = 10,
    Log = 11,
    Min = 12,
    Max = 13,
    Dot = 14,
    Cross = 15,
    Round = 16,
    Abs = 17,
    Noise = 18,
    Grad = 19, // Add Angle?
    Blur = 20, // ?
    Warp = 21, // ?
    Filter = 22, // ?
    // HSVtoRGB = 23, // ?
    Mod = 23,
}

export type NodeArg = Node | number | Color;

export interface Node {
    texture: GeneticTexture;
    args: NodeArg[];
}

export interface EvoArt {
    root: Node;
    randomSeed: number;
}

export interface Color {
    r: number;
    b: number;
    g: number;
    a: number;
}

export interface Point {
    x: number;
    y: number;
}

export interface Environment {
    x: number;
    y: number;
    height: number;
    width: number;
    getRandom: () => number;
}

export type Primary = number | Color;

export const enum PrimaryType {
    Any = 1,
    Number = 2,
    Color = 3,
}

function getPrimaryType(primary: Primary): PrimaryType {
    return typeof primary === 'number' ? PrimaryType.Number : PrimaryType.Color;
}

function wrapWithType(primary: Primary) {
    return {
        type: getPrimaryType(primary),
        value: primary,
    }
}

function bindColor(color: Color): Color {
    return {
        r: Math.max(color.r % 1, 0),
        g: Math.max(color.g % 1, 0),
        b: Math.max(color.b % 1, 0),
        a: 1,
    };
}

function toColor(primary: Primary): Color {
    if ((typeof primary) === 'object') return primary as Color;
    return bindColor({
        r: primary as number,
        g: primary as number,
        b: primary as number,
        a: 255,
    });
}

function binaryColorExpression(node: Node, env: Environment, op: (left: Color, right: Color) => Primary) {

    const left = toColor(evalNode(node.args[0] as Node, env));
    const right = toColor(evalNode(node.args[1] as Node, env));

    const result = wrapWithType(op(left, right));

    return result.type === PrimaryType.Color 
        ? bindColor(result.value as Color) 
        : result.value;
}

function binaryExpression(node: Node, env: Environment, op: (left: number, right: number) => number) {

    const left = wrapWithType(evalNode(node.args[0] as Node, env));
    const right = wrapWithType(evalNode(node.args[1] as Node, env));

    if (left.type === right.type && left.type === PrimaryType.Number) {
        return op((left.value as number), (right.value as number));
    }

    const leftValue = toColor(left.value);
    const rightValue = toColor(right.value);

    return bindColor({
        r: op(leftValue.r, rightValue.r),
        g: op(leftValue.g, rightValue.g),
        b: op(leftValue.b, rightValue.b),
        // a: op(leftValue.a, rightValue.a),
        a: 1,
    });
}

function unaryExpression(node: Node, env: Environment, op: (operand: number) => number) {
    
    const operand = wrapWithType(evalNode(node.args[0] as Node, env));

    if (operand.type === PrimaryType.Number) {
        return op(operand.value as number);
    }

    const operandValue = toColor(operand.value);

    return bindColor({
        r: op(operandValue.r),
        g: op(operandValue.g),
        b: op(operandValue.b),
        // a: op(operandValue.a),
        a: 1,
    });
}

function noise(node: Node, env: Environment): Color {
    return {
        r: env.getRandom(),
        g: env.getRandom(),
        b: env.getRandom(),
        a: 1,
    };
}

function grad(node: Node, env: Environment): Color {

    const p = env.x;

    const leftValue = toColor(evalNode(node.args[0] as Node, env));
    const rightValue = toColor(evalNode(node.args[1] as Node, env));

    return bindColor({
        r: leftValue.r * p + rightValue.r * (1 - p),
        g: leftValue.g * p + rightValue.g * (1 - p),
        b: leftValue.b * p + rightValue.b * (1 - p),
        a: 1,
    });
}

const geneticTextureEval = {
    0: (node, env) => env.x,
    1: (node, env) => env.y,
    2: node => node.args[0],
    3: node => node.args[0],
    4: (node, env) => binaryExpression(node, env, (l, r) => l + r),
    5: (node, env) => binaryExpression(node, env, (l, r) => l - r),
    6: (node, env) => binaryExpression(node, env, (l, r) => l * r),
    7: (node, env) => binaryExpression(node, env, (l, r) => l / r),
    8: (node, env) => binaryExpression(node, env, (l, r) => Math.pow(l, r)),
    9: (node, env) => unaryExpression(node, env, op => Math.cos(op)),
    10: (node, env) => unaryExpression(node, env, op => Math.sin(op)),
    11: (node, env) => unaryExpression(node, env, op => op !== 0 ? Math.log(op) : 0),
    12: (node, env) => binaryExpression(node, env, (l, r) => Math.min(l, r)),
    13: (node, env) => binaryExpression(node, env, (l, r) => Math.max(l, r)),
    14: (node, env) => binaryColorExpression(node, env, (l, r) => l.r * r.r + l.g * r.g + l.b * r.b),
    15: (node, env) => binaryColorExpression(node, env, (l, r) => bindColor({
        r: l.g * r.b - l.b * r.g,
        g: l.b * r.r - l.r * r.b,
        b: l.r * r.g - l.g * r.r,
        a: 1,
    })),
    16: (node, env) => unaryExpression(node, env, op => Math.round(op)),
    17: (node, env) => unaryExpression(node, env, op => Math.abs(op)),
    18: noise,
    19: grad,
    23: (node, env) => binaryExpression(node, env, (l, r) => l % r),
};

const geneticTextureDef = {
    0: { args: [], return: PrimaryType.Number },
    1: { args: [], return: PrimaryType.Number },
    2: { args: [PrimaryType.Number], return: PrimaryType.Color },
    3: { args: [PrimaryType.Number], return: PrimaryType.Number },
    4: { args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
    5: { args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
    6: { args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
    7: { args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
    8: { args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
    9: { args: [PrimaryType.Any], return: PrimaryType.Any },
    10: { args: [PrimaryType.Any], return: PrimaryType.Any },
    11: { args: [PrimaryType.Any], return: PrimaryType.Any },
    12: { args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
    13: { args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
    14: { args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Number },
    15: { args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Color },
    16: { args: [PrimaryType.Any], return: PrimaryType.Any },
    17: { args: [PrimaryType.Any], return: PrimaryType.Any },
    18: { args: [], return: PrimaryType.Color },
    19: { args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Color },
    23: { args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
};

const geneticTextureReturns = {
    [PrimaryType.Color]: [
        { type: 2, args: [PrimaryType.Number], return: PrimaryType.Color },
        { type: 4, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        { type: 5, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        { type: 6, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        { type: 7, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        { type: 8, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        { type: 9, args: [PrimaryType.Any], return: PrimaryType.Any },
        { type: 10, args: [PrimaryType.Any], return: PrimaryType.Any },
        { type: 11, args: [PrimaryType.Any], return: PrimaryType.Any },
        { type: 12, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        { type: 13, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        { type: 15, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Color },
        { type: 16, args: [PrimaryType.Any], return: PrimaryType.Any },
        { type: 17, args: [PrimaryType.Any], return: PrimaryType.Any },
        { type: 18, args: [], return: PrimaryType.Color },
        { type: 19, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Color },
        { type: 23, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
    ],
    [PrimaryType.Number]: [
        { type: 0, args: [], return: PrimaryType.Number },
        { type: 1, args: [], return: PrimaryType.Number },
        { type: 3, args: [PrimaryType.Number], return: PrimaryType.Number },
        { type: 4, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        { type: 5, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        { type: 6, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        { type: 7, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        { type: 8, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        { type: 9, args: [PrimaryType.Any], return: PrimaryType.Any },
        { type: 10, args: [PrimaryType.Any], return: PrimaryType.Any },
        { type: 11, args: [PrimaryType.Any], return: PrimaryType.Any },
        { type: 12, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        { type: 13, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        { type: 14, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Number },
        { type: 16, args: [PrimaryType.Any], return: PrimaryType.Any },
        { type: 17, args: [PrimaryType.Any], return: PrimaryType.Any },
        { type: 23, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
    ],
}

function evalNode(node: Node, environment: Environment): Color {
    return geneticTextureEval[node.texture](node, environment);
}

function setPixel(context: CanvasRenderingContext2D, point: Point, color: Color): void {
    context.fillStyle = 'rgba('+Math.round(color.r * 256)+','+Math.round(color.g * 256)+','+Math.round(color.b * 256)+','+(color.a)+')';
    context.fillRect(point.x, point.y, 1, 1);
}

function renderEvoArt(context: CanvasRenderingContext2D, evoArt: EvoArt, width: number, height: number): void {
    
    const prng = new (Math as any).seedrandom(evoArt.randomSeed.toString());

    const environment: Environment = {
        x: 0,
        y: 0,
        height: height,
        width: width,
        getRandom: prng,
    };

    const rootNode = evoArt.root;
    // (window as any).abc = [];
    const start = performance.now();

    const imageData = context.getImageData(0, 0, width, height);

    const buffer = new ArrayBuffer(imageData.data.length);
    const buffer8 = new Uint8ClampedArray(buffer);
    const data = new Uint32Array(buffer);

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            
            environment.x = x / width;
            environment.y = y / height;
            
            const pixel = {
                x: x,
                y: y,
            };

            const color = evalNode(rootNode, environment);

            // (window as any).abc.push(color)

            data[y * width + x] = 
                (255 << 24) |
                (Math.round(color.b * 255) << 16) |
                (Math.round(color.g * 255) << 8) |
                Math.round(color.r * 255);
        }
    }

    imageData.data.set(buffer8);

    context.putImageData(imageData, 0, 0);

    console.log(performance.now() - start)
}

function generateRandomEvoArt(maxDepth: number): EvoArt {

    return {
        randomSeed: Math.random(),
        root: getRandomNode(maxDepth),
    };
}

function getRandomNode(maxDepth: number, returns: PrimaryType = PrimaryType.Color, depth = 0): Node {

    if (depth >= maxDepth - 1) {
        return getRandomTerminal(returns);
    }

    const textures = geneticTextureReturns[returns];
    const randomTexture = Math.round(textures.length * Math.random());

}

function convertAnysToTypes(returns: PrimaryType, args: PrimaryType[]): PrimaryType[] {
    
    if (returns === PrimaryType.Number) {
        
        return new Array(args.length).fill(PrimaryType.Number);

    } else if (returns === PrimaryType.Color) {

        // Pick random number of color args for every any arg

    } else { // Either type works

    }
}

function getRandomTerminal(type: PrimaryType): Node {

    const randTerminalType = Math.random();

    if (type === PrimaryType.Color || (type === PrimaryType.Any && randTerminalType >= .5)) {
        return {
            texture: GeneticTexture.Color,
            args: [{
                r: Math.random(),
                g: Math.random(),
                b: Math.random(),
                a: 1,
            }],
        };
    }

    const randNumberType = Math.random();

    if (randNumberType <= .33) {
        return {
            texture: GeneticTexture.Const,
            args: [Math.random()],
        };
    } else if (randNumberType > .33 && randNumberType <= .66) {
        return {
            texture: GeneticTexture.X,
            args: [],
        };
    } else {
        return {
            texture: GeneticTexture.Y,
            args: [],
        };
    }
}

const testEvoArt: EvoArt = {
    randomSeed: 1337,
    root: {
        texture: GeneticTexture.Add,
        args: [
            {
                texture: GeneticTexture.Mult,
                args: [
                    {
                        texture: GeneticTexture.Grad,
                        args: [
                            {
                                texture: GeneticTexture.Color,
                                args: [{
                                    r: 65 / 255,
                                    g: 126 / 255,
                                    b: 231 / 255,
                                    a: 1,
                                }],
                            },
                            {
                                texture: GeneticTexture.Color,
                                args: [{
                                    r: 234 / 255,
                                    g: 15 / 255,
                                    b: 93 / 255,
                                    a: 1,
                                }],
                            },
                        ],
                    },
                    {
                        texture: GeneticTexture.Y,
                        args: [],
                    },
                ],
            },
            {
                texture: GeneticTexture.Cos,
                args: [
                    {
                        texture: GeneticTexture.Pow,
                        args: [
                            {
                                texture: GeneticTexture.X,
                                args: [],
                            },
                            {
                                texture: GeneticTexture.Y,
                                args: [],
                            },
                        ],
                    },
                ],
            }
        ],
    },
}

// const gradient1 = {
//     texture: GeneticTexture.Grad,
//     args: [
//         {
//             texture: GeneticTexture.Color,
//             args: [{
//                 r: 65 / 255,
//                 g: 126 / 255,
//                 b: 231 / 255,
//                 a: 1,
//             }],
//         },
//         {
//             texture: GeneticTexture.Color,
//             args: [{
//                 r: 234 / 255,
//                 g: 15 / 255,
//                 b: 93 / 255,
//                 a: 1,
//             }],
//         },
//     ],
// };

// const gradient2 = {
//     texture: GeneticTexture.Grad,
//     args: [
//         {
//             texture: GeneticTexture.Color,
//             args: [{
//                 r: 5 / 255,
//                 g: 16 / 255,
//                 b: 131 / 255,
//                 a: 1,
//             }],
//         },
//         {
//             texture: GeneticTexture.Color,
//             args: [{
//                 r: 200 / 255,
//                 g: 150 / 255,
//                 b: 14 / 255,
//                 a: 1,
//             }],
//         },
//     ],
// };

// const testEvoArt: EvoArt = {
//     randomSeed: 1337,
//     root: {
//         texture: GeneticTexture.Mult,
//         args: [
//             gradient1,
//             {
//                 texture: GeneticTexture.Mult,
//                 args: [
//                     {
//                         texture: GeneticTexture.Sin,
//                         args: [{
//                             texture: GeneticTexture.X,
//                             args: [],
//                         }],
//                     },
//                     {
//                         texture: GeneticTexture.Cos,
//                         args: [{
//                             texture: GeneticTexture.Y,
//                             args: [],
//                         }],
//                     },
//                 ],
//             },
//         ],
//     }
// };

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
})
export class AppComponent {

    @ViewChild('test')
    public canvas: ElementRef;

    public ngOnInit(): void {
        const context = this.canvas.nativeElement.getContext('2d') as CanvasRenderingContext2D;
        console.log(this, context)
        
        renderEvoArt(context, testEvoArt, 256, 256);

        // Represent image as genetically derived equation
        // How to represent it in Solidity?

    }
}