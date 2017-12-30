import { Component } from '@angular/core';
import { ViewChild } from '@angular/core/src/metadata/di';

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
    HSVtoRGB = 18,
    Noise = 19,
    Grad = 20,
    Blur = 21,
    Warp = 22,
    Filter = 23,
}

export interface Node {
    texture: GeneticTexture;
    args: any[];
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
    if ((primary as Color).r) return primary as Color;
    return bindColor({
        r: primary as number,
        g: primary as number,
        b: primary as number,
        a: 255,
    });
}

function binaryExpression(node: Node, env: Environment, op: (left: number, right: number, leftColor?: Color, rightColor?: Color) => number) {

    const left = wrapWithType(evalNode(node.args[0], env));
    const right = wrapWithType(evalNode(node.args[1], env));

    if (left.type === right.type && left.type === 'number') {
        return op((left.value as number), (right.value as number));
    }

    const leftValue = toColor(left.value);
    const rightValue = toColor(right.value);

    return bindColor({
        r: op(leftValue.r, rightValue.r, leftValue, rightValue),
        g: op(leftValue.g, rightValue.g, leftValue, rightValue),
        b: op(leftValue.b, rightValue.b, leftValue, rightValue),
        // a: op(leftValue.a, rightValue.a),
        a: 255,
    });
}

function unaryExpression(node: Node, env: Environment, op: (operand: number, operandColor?: Color) => number) {
    
    const operand = wrapWithType(evalNode(node.args[0], env));

    if (operand.type === 'number') {
        return op(operand.value as number);
    }

    const operandValue = toColor(operand.value);

    return bindColor({
        r: op(operandValue.r, operandValue),
        g: op(operandValue.g, operandValue),
        b: op(operandValue.b, operandValue),
        // a: op(operandValue.a),
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
    11: (node, env) => unaryExpression(node, env, op => Math.log(op)),
    12: (node, env) => binaryExpression(node, env, (l, r) => Math.min(l, r)),
    13: (node, env) => binaryExpression(node, env, (l, r) => Math.max(l, r)),
    // 14: (node, env) => binaryExpression(node, env, (l, r, lc, rc) => ), // Undo xColor? Make more general binaryExpression? Make specific Vectorized binaryExpression
    // 15: (node, env) => binaryExpression(node, env, (l, r, lc, rc) => ), // Undo xColor? Make more general binaryExpression? Make specific Vectorized binaryExpression
    16: (node, env) => unaryExpression(node, env, op => Math.round(op)),
    17: (node, env) => unaryExpression(node, env, op => Math.abs(op)),
    
};

function evalNode(node: Node, environment: Environment): any {

    return geneticTextureEval[node.texture](node, environment);
}

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
})
export class AppComponent {

    @ViewChild('test')
    public canvas: HTMLCanvasElement;

    public ngOnInit(): void {

        const context = this.canvas.getContext('2d');
        
        // Represent image as genetically derived equation
        // How to represent it in Solidity?

    }

    public setPixel(context: CanvasRenderingContext2D, point: Point, color: Color): void {
        context.fillStyle = 'rgba('+color.r+','+color.g+','+color.b+','+(color.a / 255)+')';
        context.fillRect(point.x, point.y, 1, 1);
    }
}