import { Component, ElementRef, ViewChild } from '@angular/core';
import 'seedrandom/seedrandom';

/*
    +, -, *, /, mod, round, min, max, abs, expt, log, and, 
    or, xor, sin, cos, atan, if, dissolve, hsv-to-rgb, vector, 
	transform-vector, bw-noise, color-noise, warped-bw-noise, 
	warped-color-noise, blur, band-pass, grad-mag, grad-dir, 
    bump, ifs, warped-ifs, warp-abs, warp-rel, warp-by-grad.
*/
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
    HSVtoRGB = 23, // ?
    Mod = 24,
    Invert = 25,
    Atan = 27,
    Dissolve = 28 // ????
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
}

export interface Point {
    x: number;
    y: number;
}

export const enum ViewType {
    RGB = 0,
    BW = 1,
}

export interface RGBView {
    type: ViewType.RGB;
    read: Uint8ClampedArray;
    write: Uint32Array;
}

export interface BWView {
    type: ViewType.BW;
    read: Float32Array;
    write: Float32Array;
}

export type View = RGBView | BWView;

export interface Environment {
    height: number;
    width: number;
    getRandom(): number;
    newRGBView(): RGBView;
    newBWView(): BWView;
}

export type Primary = number | Color | View;

export const enum PrimaryType {
    Any = 1,
    Number = 2,
    Color = 3,
    View = 4,
}

function getPrimaryType(primary: Primary): PrimaryType {
    return typeof primary === 'number' 
        ? PrimaryType.Number 
        : typeof primary === 'object' && (primary as View).type != null
            ? PrimaryType.View 
            : PrimaryType.Color;
}

interface TypeWrappedPrimary {
    type: PrimaryType;
    value: Primary;
}

function wrapWithType(primary: Primary): TypeWrappedPrimary {
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
    };
}

function toColor(primary: number | Color): Color {
    if ((typeof primary) === 'object') return primary as Color;
    return bindColor({
        r: primary as number,
        g: primary as number,
        b: primary as number,
    });
}

function binaryColorExpression(node: Node, env: Environment, op: (left: Color, right: Color) => Primary) {

    const left = toColor(evalNode(node.args[0] as Node, env) as number | Color);
    const right = toColor(evalNode(node.args[1] as Node, env) as number | Color);

    const result = wrapWithType(op(left, right));

    return result.type === PrimaryType.Color 
        ? bindColor(result.value as Color) 
        : result.value;
}

function binaryElementWiseRGBViewExpression(env: Environment, left: RGBView, right: RGBView, op: (left: number, right: number) => number) {

    const rgbView = env.newRGBView();
    const writeRGB = rgbView.write;

    const height = env.height;
    const width = env.width;

    const leftViewRead = left.read;
    const rightViewRead = right.read;
    
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {

            const i32 = y * width + x;
            let i8 = i32 * 4 + 2;

            // // R
            // leftViewRead[i8]
            // rightViewRead[i8]

            // // G
            // leftViewRead[--i8]
            // rightViewRead[i8]

            // // B
            // leftViewRead[--i8]
            // rightViewRead[i8]

            writeRGB[i32] =
                -16777216 |
                (Math.round(op(leftViewRead[i8], rightViewRead[i8]) * 255) << 16) |
                (Math.round(op(leftViewRead[--i8], rightViewRead[i8]) * 255) << 8) |
                Math.round(op(leftViewRead[--i8], rightViewRead[i8]) * 255);
        }
    }

    return rgbView;
}

function binaryElementWiseBWViewExpression(env: Environment, left: BWView, right: BWView, op: (left: number, right: number) => number) {

    const bwView = env.newBWView();
    const writeBW = bwView.write;

    const height = env.height;
    const width = env.width;

    const leftViewRead = left.read;
    const rightViewRead = right.read;
    
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {

            const i = y * width + x;

            writeBW[i] = op(leftViewRead[i], rightViewRead[i]);
        }
    }

    return bwView;
}

function binaryElementWiseRGB_BWExpression(env: Environment, left: RGBView, right: BWView, op: (left: number, right: number) => number) {

    const rgbView = env.newRGBView();
    const writeRGB = rgbView.write;

    const height = env.height;
    const width = env.width;

    const leftViewRead = left.read;
    const rightViewRead = right.read;
    
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {

            const i32 = y * width + x;
            let i8 = i32 * 4 + 2;

            const rightValue = rightViewRead[i32];

            writeRGB[i32] =
                -16777216 |
                (Math.round(op(leftViewRead[i8], rightValue) * 255) << 16) |
                (Math.round(op(leftViewRead[--i8], rightValue) * 255) << 8) |
                Math.round(op(leftViewRead[--i8], rightValue) * 255);
        }
    }

    return rgbView;
}

function binaryElementWiseBW_RGBExpression(env: Environment, left: BWView, right: RGBView, op: (left: number, right: number) => number) {

    const rgbView = env.newRGBView();
    const writeRGB = rgbView.write;

    const height = env.height;
    const width = env.width;

    const leftViewRead = left.read;
    const rightViewRead = right.read;
    
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {

            const i32 = y * width + x;
            let i8 = i32 * 4 + 2;

            const leftValue = leftViewRead[i32];

            writeRGB[i32] =
                -16777216 |
                (Math.round(op(leftValue, rightViewRead[i8]) * 255) << 16) |
                (Math.round(op(leftValue, rightViewRead[--i8]) * 255) << 8) |
                Math.round(op(leftValue, rightViewRead[--i8]) * 255);
        }
    }

    return rgbView;
}

function binaryElementWiseViewExpression(env: Environment, left: View, right: View, op: (left: number, right: number) => number) {

    if (left.type === right.type) {

        if (left.type === ViewType.RGB) {
        
            return binaryElementWiseRGBViewExpression(env, left, right as RGBView, op);

        } else { // BWView

            return binaryElementWiseBWViewExpression(env, left, right as BWView, op);
        }

    } else { // Different ViewTypes

        if (left.type === ViewType.RGB) { // left: RGB, right: BW
        
            return binaryElementWiseRGB_BWExpression(env, left, right as BWView, op);

        } else { // left: BW, right: RGB

            return binaryElementWiseBW_RGBExpression(env, left, right as RGBView, op);
        }
    }
}

function binaryElementWiseExpression(node: Node, env: Environment, op: (left: number, right: number) => number) {

    const left = wrapWithType(evalNode(node.args[0] as Node, env));
    const right = wrapWithType(evalNode(node.args[1] as Node, env));

    if (left.type === right.type) {

        if (left.type === PrimaryType.Number) {

            return op((left.value as number), (right.value as number));

        } else if (left.type === PrimaryType.Color) {

            const leftValue = left.value as Color;
            const rightValue = right.value as Color;
            
            return bindColor({
                r: op(leftValue.r, rightValue.r),
                g: op(leftValue.g, rightValue.g),
                b: op(leftValue.b, rightValue.b),
            });

        } else if (left.type === PrimaryType.View) {

            return binaryElementWiseViewExpression(env, left.value as View, right.value as View, op);
        }

    } else {

        const coerceToType = Math.max(left.type, right.type) as PrimaryType;

        if (coerceToType === PrimaryType.Color) {

            let leftValue: Color;
            let rightValue: Color;

            if (left.type !== PrimaryType.Color) {

                leftValue = toColor(left.value as number);
                rightValue = right.value as Color;

            } else {

                leftValue = left.value as Color
                rightValue = toColor(right.value as number);
            }

            return bindColor({
                r: op(leftValue.r, rightValue.r),
                g: op(leftValue.g, rightValue.g),
                b: op(leftValue.b, rightValue.b),
            });

        } else if (coerceToType === PrimaryType.View) {

            let leftValue: View;
            let rightValue: View;

            if (left.type !== PrimaryType.Color) {

                leftValue = colorToView(env, toColor(left.value as number));
                rightValue = right.value as View;

            } else {

                leftValue = left.value as View;
                rightValue = colorToView(env, toColor(right.value as number));
            }

            return binaryElementWiseViewExpression(env, leftValue, rightValue, op);
        }
    }
}

function unaryElementWiseRGBViewExpression(env: Environment, operand: RGBView, op: (left: number) => number) {

    const rgbView = env.newRGBView();
    const writeRGB = rgbView.write;

    const height = env.height;
    const width = env.width;

    const operandViewRead = operand.read;
    
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {

            const i32 = y * width + x;
            let i8 = i32 * 4 + 2;

            writeRGB[i32] =
                -16777216 |
                (Math.round(op(operandViewRead[i8]) * 255) << 16) |
                (Math.round(op(operandViewRead[--i8]) * 255) << 8) |
                Math.round(op(operandViewRead[--i8]) * 255);
        }
    }

    return rgbView;
}

function unaryElementWiseBWViewExpression(env: Environment, operand: BWView, op: (left: number) => number) {

    const bwView = env.newBWView();
    const writeBW = bwView.write;

    const height = env.height;
    const width = env.width;

    const operandViewRead = operand.read;
    
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {

            const i = y * width + x;

            writeBW[i] = op(operandViewRead[i]);
        }
    }

    return bwView;
}

function unaryExpression(node: Node, env: Environment, op: (operand: number) => number) {
    
    const operand = wrapWithType(evalNode(node.args[0] as Node, env));

    if (operand.type === PrimaryType.Number) {

        return op(operand.value as number);

    } else if (operand.type === PrimaryType.Color) {

        const color = operand.value as Color;

        return bindColor({
            r: op(color.r),
            g: op(color.g),
            b: op(color.b),
        });

    } else { // View

        const operandValue = operand.value as View;

        if (operandValue.type === ViewType.RGB) {

            return unaryElementWiseRGBViewExpression(env, operandValue, op);

        } else { // BW

            return unaryElementWiseBWViewExpression(env, operandValue, op);
        }
    }
}

function colorToView(env: Environment, { r, g, b }: Color): RGBView {

    const rgbView = env.newRGBView();
    const writeRGB = rgbView.write;

    const height = env.height;
    const width = env.width;

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {

            writeRGB[y * width + x] =
                -16777216 |
                ((b % 256) << 16) |
                ((g % 256) << 8) |
                (r % 256);
        }
    }

    return rgbView;
}

function noise(node: Node, env: Environment): RGBView {

    const rgbView = env.newRGBView();
    const writeRGB = rgbView.write;

    const height = env.height;
    const width = env.width;

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {

            writeRGB[y * width + x] =
                -16777216 |
                (Math.round(env.getRandom() * 255) << 16) |
                (Math.round(env.getRandom() * 255) << 8) |
                Math.round(env.getRandom() * 255);
        }
    }

    return rgbView;
}

function grad(node: Node, env: Environment): RGBView {

    const { r: lR, g: lG, b: lB } = evalNode(node.args[0] as Node, env) as Color;
    const { r: rR, g: rG, b: rB } = evalNode(node.args[1] as Node, env) as Color;

    const rgbView = env.newRGBView();
    const writeRGB = rgbView.write;

    const height = env.height;
    const width = env.width;
    
    for (let x = 0; x < width; x++) {

        const ip = x / width;
        const p = 1 - ip;

        for (let y = 0; y < height; y++) {

            writeRGB[y * width + x] =
                -16777216 |
                (Math.round((lB * p + rB * ip) * 255) << 16) |
                (Math.round((lG * p + rG * ip) * 255) << 8) |
                Math.round((lR * p + rR * ip) * 255);
        }
    }

    return rgbView;
}

function hsvToRGB(node: Node, env: Environment): RGBView {

    const rgbView = env.newRGBView();
    const writeRGB = rgbView.write;

    const height = env.height;
    const width = env.width;

    const color = toColor(evalNode(node.args[0] as Node, env) as number | Color);

    const h = color.r;
    const s = color.g;
    const v = color.b;

    let r, g, b, i, f, p, q, t;

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {

            i = Math.floor(h * 6);
            f = h * 6 - i;
            p = v * (1 - s);
            q = v * (1 - f * s);
            t = v * (1 - (1 - f) * s);
            switch (i % 6) {
                case 0: r = v, g = t, b = p; break;
                case 1: r = q, g = v, b = p; break;
                case 2: r = p, g = v, b = t; break;
                case 3: r = p, g = q, b = v; break;
                case 4: r = t, g = p, b = v; break;
                case 5: r = v, g = p, b = q; break;
            }

            writeRGB[y * width + x] =
                -16777216 |
                (Math.round(b * 255) << 16) |
                (Math.round(g * 255) << 8) |
                Math.round(r * 255);
        }
    }

    return rgbView;
}

const geneticTextureEval = {
    0: (node, env) => env.x,
    1: (node, env) => env.y,
    2: node => node.args[0],
    3: node => node.args[0],
    4: (node, env) => binaryElementWiseExpression(node, env, (l, r) => l + r),
    5: (node, env) => binaryElementWiseExpression(node, env, (l, r) => l - r),
    6: (node, env) => binaryElementWiseExpression(node, env, (l, r) => l * r),
    7: (node, env) => binaryElementWiseExpression(node, env, (l, r) => l / r),
    8: (node, env) => binaryElementWiseExpression(node, env, (l, r) => Math.pow(l, r)),
    9: (node, env) => unaryExpression(node, env, op => Math.cos(op)),
    10: (node, env) => unaryExpression(node, env, op => Math.sin(op)),
    11: (node, env) => unaryExpression(node, env, op => op !== 0 ? Math.log(op) : 0),
    12: (node, env) => binaryElementWiseExpression(node, env, (l, r) => Math.min(l, r)),
    13: (node, env) => binaryElementWiseExpression(node, env, (l, r) => Math.max(l, r)),
    14: (node, env) => binaryColorExpression(node, env, (l, r) => l.r * r.r + l.g * r.g + l.b * r.b),
    15: (node, env) => binaryColorExpression(node, env, (l, r) => bindColor({
        r: l.g * r.b - l.b * r.g,
        g: l.b * r.r - l.r * r.b,
        b: l.r * r.g - l.g * r.r,
    })),
    16: (node, env) => unaryExpression(node, env, op => Math.round(op)),
    17: (node, env) => unaryExpression(node, env, op => Math.abs(op)),
    18: noise,
    19: grad,
    23: hsvToRGB,
    24: (node, env) => binaryElementWiseExpression(node, env, (l, r) => l % r),
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
    23: { args: [PrimaryType.Color], return: PrimaryType.Color },
    24: { args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
};

const geneticTextureReturns = {
    [PrimaryType.Color]: [
        { type: 2, args: [PrimaryType.Number], return: PrimaryType.Color },
        { type: 4, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        { type: 5, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        // { type: 6, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        { type: 7, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        { type: 8, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        { type: 9, args: [PrimaryType.Any], return: PrimaryType.Any },
        { type: 10, args: [PrimaryType.Any], return: PrimaryType.Any },
        // { type: 11, args: [PrimaryType.Any], return: PrimaryType.Any },
        // { type: 12, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        // { type: 13, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        // { type: 15, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Color },
        // { type: 16, args: [PrimaryType.Any], return: PrimaryType.Any },
        { type: 17, args: [PrimaryType.Any], return: PrimaryType.Any },
        // { type: 18, args: [], return: PrimaryType.Color },
        { type: 19, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Color },
        { type: 23, args: [PrimaryType.Color], return: PrimaryType.Color },
        // { type: 24, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
    ],
    [PrimaryType.Number]: [
        { type: 0, args: [], return: PrimaryType.Number },
        { type: 1, args: [], return: PrimaryType.Number },
        { type: 3, args: [PrimaryType.Number], return: PrimaryType.Number },
        { type: 4, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        { type: 5, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        // { type: 6, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        { type: 7, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        { type: 8, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        { type: 9, args: [PrimaryType.Any], return: PrimaryType.Any },
        { type: 10, args: [PrimaryType.Any], return: PrimaryType.Any },
        // { type: 11, args: [PrimaryType.Any], return: PrimaryType.Any },
        // { type: 12, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        // { type: 13, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
        // { type: 14, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Number },
        // { type: 16, args: [PrimaryType.Any], return: PrimaryType.Any },
        { type: 17, args: [PrimaryType.Any], return: PrimaryType.Any },
        // { type: 24, args: [PrimaryType.Any, PrimaryType.Any], return: PrimaryType.Any },
    ],
}

function evalNode(node: Node, environment: Environment): Primary {
    return geneticTextureEval[node.texture](node, environment);
}

function newRGBView(size: number): RGBView {

    const buffer = new ArrayBuffer(size);

    return {
        type: ViewType.RGB,
        read: new Uint8ClampedArray(buffer),
        write: new Uint32Array(buffer),
    };
}

function newBWView(size: number): BWView {

    const readWrite = new Float32Array(size);

    return {
        type: ViewType.BW,
        read: readWrite,
        write: readWrite,
    };
}

function bwToRGB(env: Environment, bwView: BWView): RGBView {

    const bwRead = bwView.read;

    const rgbView = env.newRGBView();
    const writeRGB = rgbView.write;

    const height = env.height;
    const width = env.width;

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {

            const i = y * width + x;

            const bwValue = Math.round(bwRead[i] * 255);

            writeRGB[i] = 
                -16777216 |
                (bwValue << 16) |
                (bwValue << 8) |
                bwValue;
        }
    }

    return rgbView;
}

function renderEvoArt(context: CanvasRenderingContext2D, evoArt: EvoArt, width: number, height: number): void {
        
    const prng = new (Math as any).seedrandom(evoArt.randomSeed.toString());
    
    const imageData = context.getImageData(0, 0, width, height);
    const imageDataSize = imageData.data.length;
    
    const env: Environment = {
        height: height,
        width: width,
        getRandom: prng,
        newRGBView: () => newRGBView(imageDataSize),
        newBWView: () => newBWView(imageDataSize),
    };
    
    const rootNode = evoArt.root;
    
    const start = performance.now();
    
    const view = evalNode(rootNode, env) as View;

    const rgbView = view.type === ViewType.RGB 
        ? view 
        : bwToRGB(env, view);

    imageData.data.set(rgbView.read);

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
    const randomTexture = textures[Math.floor(textures.length * Math.random())];

    const textureArgs = convertAnysToTypes(randomTexture.args, randomTexture.return);

    return {
        texture: randomTexture.type,
        args: textureArgs.map(arg => getRandomNode(maxDepth, arg, depth + 1)),
    };
}

function convertAnysToTypes(args: PrimaryType[], returns: PrimaryType): PrimaryType[] {
    
    if (args.length === 0) {

        return [];

    } if (!args.some(a => a === PrimaryType.Any)) {

        return args.slice();

    } else if (returns === PrimaryType.Number) {
        
        return new Array(args.length).fill(PrimaryType.Number);

    } else if (returns === PrimaryType.Color) {

        let randomizedArgs = args.slice();
        
        while (!randomizedArgs.some(a => a === PrimaryType.Color)) {

            randomizedArgs = args
                .map(a => 
                    a === PrimaryType.Any
                        ? Math.random() >= .5
                            ? PrimaryType.Color
                            : PrimaryType.Number
                        : a
                );
        }

        return randomizedArgs;

    } else { // Either type works

        return args.map(a => 
            a === PrimaryType.Any
                ? Math.random() >= .5
                    ? PrimaryType.Color
                    : PrimaryType.Number
                : a
        );
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
            }],
        };
    }

    const randNumberType = Math.random();

    if (randNumberType <= .33) {
        return {
            texture: GeneticTexture.Const,
            args: [Math.random() * 255],
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

    public evoArtTree: string;

    public ngOnInit(): void {
        const context = this.canvas.nativeElement.getContext('2d') as CanvasRenderingContext2D;
        console.log(this, context)
        
        renderEvoArt(context, testEvoArt, 256, 256);

        // Represent image as genetically derived equation
        // How to represent it in Solidity?

    }

    public onNew(): void {

        const context = this.canvas.nativeElement.getContext('2d') as CanvasRenderingContext2D;

        const randomEvoArt = generateRandomEvoArt(4);

        renderEvoArt(context, randomEvoArt, 512, 512);

        this.evoArtTree = JSON.stringify(randomEvoArt, null, 2);
    }
}