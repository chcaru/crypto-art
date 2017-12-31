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
    Grad = 19,
    Blur = 20,
    Warp = 21,
    Filter = 22,
    // HSVtoRGB = 23,
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

function getPrimaryType(primary: Primary): 'number' | 'color' {
    return typeof primary === 'number' ? 'number' : 'color';
}

function wrapWithType(primary: Primary) {
    return {
        type: getPrimaryType(primary),
        value: primary,
    }
}

function bindColor(color: Color): Color {
    return {
        r: Math.max(color.r % 256, 0),
        g: Math.max(color.g % 256, 0),
        b: Math.max(color.b % 256, 0),
        a: Math.max(color.a % 256, 0),
    };
}

function toColor(primary: Primary): Color {
    if (typeof primary === 'object') return primary as Color;
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

    return result.type === 'color' 
        ? bindColor(result.value as Color) 
        : result.value;
}

function binaryExpression(node: Node, env: Environment, op: (left: number, right: number) => number) {

    const left = wrapWithType(evalNode(node.args[0] as Node, env));
    const right = wrapWithType(evalNode(node.args[1] as Node, env));

    if (left.type === right.type && left.type === 'number') {
        return op((left.value as number), (right.value as number));
    }

    const leftValue = toColor(left.value);
    const rightValue = toColor(right.value);

    return bindColor({
        r: op(leftValue.r, rightValue.r),
        g: op(leftValue.g, rightValue.g),
        b: op(leftValue.b, rightValue.b),
        // a: op(leftValue.a, rightValue.a),
        a: 255,
    });
}

function unaryExpression(node: Node, env: Environment, op: (operand: number) => number) {
    
    const operand = wrapWithType(evalNode(node.args[0] as Node, env));

    if (operand.type === 'number') {
        return op(operand.value as number);
    }

    const operandValue = toColor(operand.value);

    return bindColor({
        r: op(operandValue.r),
        g: op(operandValue.g),
        b: op(operandValue.b),
        // a: op(operandValue.a),
        a: 255,
    });
}

function noise(node: Node, env: Environment): Color {
    return {
        r: env.getRandom() * 255,
        g: env.getRandom() * 255,
        b: env.getRandom() * 255,
        a: 255,
    };
}

function grad(node: Node, env: Environment): Color {

    const p = env.x / env.width;

    const leftValue = toColor(evalNode(node.args[0] as Node, env));
    const rightValue = toColor(evalNode(node.args[1] as Node, env));

    return bindColor({
        r: leftValue.r * p + rightValue.r * (1 - p),
        g: leftValue.g * p + rightValue.g * (1 - p),
        b: leftValue.b * p + rightValue.b * (1 - p),
        a: 255,
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
        a: 255,
    })),
    16: (node, env) => unaryExpression(node, env, op => Math.round(op)),
    17: (node, env) => unaryExpression(node, env, op => Math.abs(op)),
    18: noise,
    19: grad,
};

function evalNode(node: Node, environment: Environment): any {
    return geneticTextureEval[node.texture](node, environment);
}

function setPixel(context: CanvasRenderingContext2D, point: Point, color: Color): void {
    context.fillStyle = 'rgba('+Math.round(color.r)+','+Math.round(color.g)+','+Math.round(color.b)+','+(color.a / 255)+')';
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
    (window as any).abc = [];
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            
            environment.x = x;
            environment.y = y;
            
            const pixel = {
                x: x,
                y: y,
            };

            const color = evalNode(rootNode, environment);

            (window as any).abc.push(color)

            setPixel(context, pixel, color);
        }
    }
}

// (grad((65, 126, 231), 173) + y) * log(x + y)
// (grad((65, 126, 231), 173) + y) * log(x + x) + y

const testEvoArt: EvoArt = {
    randomSeed: 1337,
    root: {
        texture: GeneticTexture.Mult,
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
                                    r: 65,
                                    g: 126,
                                    b: 231,   
                                }],
                            },
                            {
                                texture: GeneticTexture.Const,
                                args: [173],
                            }
                        ],
                    },
                    {
                        texture: GeneticTexture.Y,
                        args: [],
                    },
                ],
            },
            {
                texture: GeneticTexture.Abs,
                args: [
                    {
                        texture: GeneticTexture.Div,
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
        
        renderEvoArt(context, testEvoArt, 1024, 1024);

        // Represent image as genetically derived equation
        // How to represent it in Solidity?

    }
}