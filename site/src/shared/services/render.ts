import 'seedrandom/seedrandom';
import { seed, perlin2, simplex2, perlin3, simplex3 } from './noise';

const mround = Math.round;
const mcos = Math.cos;
const msin = Math.sin;
const msqrt = Math.sqrt;
const mmax = Math.max;
const mmin = Math.min;
const mpow = Math.pow;
const mlog = Math.log;
const mabs = Math.abs;
const mfloor = Math.floor;
const mceil = Math.ceil;
const matan = Math.atan;
const mtan = Math.tan;
const mepow = Math.exp;
const matan2 = Math.atan2;

const tau = Math.PI * 2;

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
    Ifs = 28,
    CrossDissolve = 29,
    Rotate = 30,
    Swirl = 31,
    Buldge = 32,
    PerlinNoise = 33,
    SimplexNoise = 34,
    PerlinRGBNoise = 35,
    RadialGrad = 36,
    PerlinRandomRGBNoise = 37,
    PerlinParticles2 = 38,
    PerlinParticles3 = 39,
    PerlinParticleStreams = 40,
    PerlinParticlesRGB2 = 41,
    Ripple = 42,
    CCFXAA = 43,
    Tan = 44,
    Normalize = 45,
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
        r: mmax(color.r % 1, 0),
        g: mmax(color.g % 1, 0),
        b: mmax(color.b % 1, 0),
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

function binaryElementWiseRGBViewExpression(env: Environment, left: RGBView, right: RGBView, ops: BinaryOperations) {

    const rgbView = env.newRGBView();
    const writeRGB = rgbView.write;

    const height = env.height;
    const width = env.width;

    const leftViewRead = left.read;
    const rightViewRead = right.read;

    const rgb = ops.rgb;
    
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {

            const i32 = y * width + x;
            let i8 = i32 * 4 + 2;

            writeRGB[i32] = rgb(i8, leftViewRead, rightViewRead);
        }
    }

    return rgbView;
}

function binaryElementWiseBWViewExpression(env: Environment, left: BWView, right: BWView, ops: BinaryOperations) {

    const bwView = env.newBWView();
    const writeBW = bwView.write;

    const height = env.height;
    const width = env.width;

    const leftViewRead = left.read;
    const rightViewRead = right.read;

    const bw = ops.bw;

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {

            const i = y * width + x;

            writeBW[i] = bw(leftViewRead[i], rightViewRead[i]);
        }
    }

    return bwView;
}

function binaryElementWiseRGB_BWExpression(env: Environment, left: RGBView, right: BWView, ops: BinaryOperations) {

    const rgbView = env.newRGBView();
    const writeRGB = rgbView.write;

    const height = env.height;
    const width = env.width;

    const leftViewRead = left.read;
    const rightViewRead = right.read;

    const rgb_bw = ops.rgb_bw;

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {

            const i32 = y * width + x;
            let i8 = i32 * 4 + 2;

            const rightValue = rightViewRead[i32];

            writeRGB[i32] = rgb_bw(i8, leftViewRead, rightValue);
        }
    }

    return rgbView;
}

function binaryElementWiseBW_RGBExpression(env: Environment, left: BWView, right: RGBView, ops: BinaryOperations) {

    const rgbView = env.newRGBView();
    const writeRGB = rgbView.write;

    const height = env.height;
    const width = env.width;

    const leftViewRead = left.read;
    const rightViewRead = right.read;
    
    const bw_rgb = ops.bw_rgb;

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {

            const i32 = y * width + x;
            let i8 = i32 * 4 + 2;

            const leftValue = leftViewRead[i32];

            writeRGB[i32] = bw_rgb(leftValue, i8, rightViewRead);
        }
    }

    return rgbView;
}

function binaryElementWiseViewExpression(env: Environment, left: View, right: View, ops: BinaryOperations) {

    if (left.type === right.type) {

        if (left.type === ViewType.RGB) {

            return binaryElementWiseRGBViewExpression(env, left, right as RGBView, ops);

        } else { // BWView

            return binaryElementWiseBWViewExpression(env, left, right as BWView, ops);
        }

    } else { // Different ViewTypes

        if (left.type === ViewType.RGB) { // left: RGB, right: BW

            return binaryElementWiseRGB_BWExpression(env, left, right as BWView, ops);

        } else { // left: BW, right: RGB

            return binaryElementWiseBW_RGBExpression(env, left, right as RGBView, ops);
        }
    }
}

interface BinaryOperations {
    bw_rgb(left: number, rightOffset: number, right: Uint8ClampedArray): number;
    bw(left: number, right: number): number;
    color(left: Color, right: Color): Primary;
    number(left: number, right: number): Primary;
    rgb_bw(leftOffset: number, left: Uint8ClampedArray, right: number): number;
    rgb(offset: number, left: Uint8ClampedArray, right: Uint8ClampedArray): number;
}

function binaryElementWiseExpression(node: Node, env: Environment, ops: BinaryOperations) {

    const left = wrapWithType(evalNode(node.args[0] as Node, env));
    const right = wrapWithType(evalNode(node.args[1] as Node, env));

    if (left.type === right.type) {

        if (left.type === PrimaryType.Number) {

            return ops.number((left.value as number), (right.value as number));

        } else if (left.type === PrimaryType.Color) {

            const leftValue = left.value as Color;
            const rightValue = right.value as Color;

            return ops.color(leftValue, rightValue);

        } else if (left.type === PrimaryType.View) {

            return binaryElementWiseViewExpression(env, left.value as View, right.value as View, ops);
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

            return ops.color(leftValue, rightValue);

        } else if (coerceToType === PrimaryType.View) {

            let leftValue: View;
            let rightValue: View;

            if (left.type !== PrimaryType.View) {

                leftValue = colorToView(env, toColor(left.value as number));
                rightValue = right.value as View;

            } else {

                leftValue = left.value as View;
                rightValue = colorToView(env, toColor(right.value as number));
            }

            return binaryElementWiseViewExpression(env, leftValue, rightValue, ops);
        }
    }
}

function unaryElementWiseRGBViewExpression(env: Environment, operand: RGBView, ops: UnaryOperations) {

    const rgbView = env.newRGBView();
    const writeRGB = rgbView.write;

    const height = env.height;
    const width = env.width;

    const operandViewRead = operand.read;

    const rgb = ops.rgb;
    
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {

            const i32 = y * width + x;
            let i8 = i32 * 4 + 2;

            writeRGB[i32] = rgb(i8, operandViewRead);
        }
    }

    return rgbView;
}

function unaryElementWiseBWViewExpression(env: Environment, operand: BWView, ops: UnaryOperations) {

    const bwView = env.newBWView();
    const writeBW = bwView.write;

    const height = env.height;
    const width = env.width;

    const operandViewRead = operand.read;

    const bw = ops.bw;

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {

            const i = y * width + x;

            writeBW[i] = bw(operandViewRead[i]);
        }
    }

    return bwView;
}

interface UnaryOperations {
    bw(operand: number): number;
    color(operand: Color): Primary;
    number(operand: number): Primary;
    rgb(offset: number, operand: Uint8ClampedArray): number;
}

function unaryExpression(node: Node, env: Environment, ops: UnaryOperations) {
    
    const operand = wrapWithType(evalNode(node.args[0] as Node, env));

    if (operand.type === PrimaryType.Number) {

        return ops.number(operand.value as number);

    } else if (operand.type === PrimaryType.Color) {

        return ops.color(operand.value as Color);

    } else { // View

        const operandValue = operand.value as View;

        if (operandValue.type === ViewType.RGB) {

            return unaryElementWiseRGBViewExpression(env, operandValue, ops);

        } else { // BW

            return unaryElementWiseBWViewExpression(env, operandValue, ops);
        }
    }
}

function colorToView(env: Environment, { r, g, b }: Color): RGBView {

    const rgbView = env.newRGBView();
    const writeRGB = rgbView.write;

    const height = env.height;
    const width = env.width;

    const color = -16777216 |
        ((b % 256) << 16) |
        ((g % 256) << 8) |
        (r % 256);

    writeRGB.fill(color);

    return rgbView;
}

function toRGBView(env: Environment, primary: Primary): RGBView {

    const primaryTyped = wrapWithType(primary);

    if (primaryTyped.type === PrimaryType.Number) {

        return colorToView(env, toColor(primaryTyped.value as number));

    } else if (primaryTyped.type === PrimaryType.Color) {

        return colorToView(env, primaryTyped.value as Color);

    } else if (primaryTyped.type === PrimaryType.View) {

        if ((primaryTyped.value as View).type === ViewType.RGB) {

            return primaryTyped.value as RGBView;

        } else { // BW

            return bwToRGB(env, primaryTyped.value as BWView);
        }
    }
}

function normalize(node: Node, env: Environment): View {

    const operand = evalNode(node.args[0] as Node, env) as View;

    const height = env.height;
    const width = env.width;

    if (operand.type === ViewType.BW) {

        const outBWView = env.newBWView();
        const bwWrite = outBWView.write;

        const bwRead = operand.read;

        let min = bwRead[0];
        let max = bwRead[0];
        
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {

                const v = bwRead[y * width + x];

                if (v > max) {
                    max = v;
                }

                if (v < min) {
                    min = v;
                }
            }
        }

        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {

            }
        }

    } else {

        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {

            }
        }

        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {

            }
        }
    }
}

(window as any).abc = []

function ccfxaa(node: Node, env: Environment): RGBView {
    // http://blog.simonrodriguez.fr/articles/30-07-2016_implementing_fxaa.html

    // 0.299*R + 0.587*G + 0.114*B

    const operand = evalNode(node.args[0] as Node, env) as View;
    const rgbView = toRGBView(env, operand);
    const readRGB = rgbView.read;
    const readRGB32 = rgbView.write;

    const outRGBView = env.newRGBView();
    const writeRGB = outRGBView.write;

    const height = env.height;
    const width = env.width;

    for (let x = 1; x < width - 1; x++) {
        for (let y = 1; y < height - 1; y++) {

            const i32 = y * width + x;
            const i8 = i32 * 4;

            let tli = ((y - 1) * width + (x - 1)) * 4;
            let ti = ((y - 1) * width + x) * 4;
            let tri = ((y - 1) * width + (x + 1)) * 4;
            let li = (y * width + (x - 1)) * 4;
            let ci = y * width + x;
            let ri = (y * width + (x + 1)) * 4;
            let bli = ((y + 1) * width + (x - 1)) * 4;
            let bi = ((y + 1) * width + x) * 4;
            let bri = ((y + 1) * width + (x + 1)) * 4;

            const tl = (readRGB[tli] + readRGB[++tli] + readRGB[++tli]) / 3 / 255;
            const t = (readRGB[ti] + readRGB[++ti] + readRGB[++ti]) / 3 / 255;
            const tr = (readRGB[tri] + readRGB[++tri] + readRGB[++tri]) / 3 / 255;
            const l = (readRGB[li] + readRGB[++li] + readRGB[++li]) / 3 / 255;
            const c = (readRGB[ci] + readRGB[++ci] + readRGB[++ci]) / 3 / 255;
            const r = (readRGB[ri] + readRGB[++ri] + readRGB[++ri]) / 3 / 255;
            const bl = (readRGB[bli] + readRGB[++bli] + readRGB[++bli]) / 3 / 255;
            const b = (readRGB[bi] + readRGB[++bi] + readRGB[++bi]) / 3 / 255;
            const br = (readRGB[bri] + readRGB[++bri] + readRGB[++bri]) / 3 / 255;

            const gx = tl + (-tr) + l * 2 + r * -2 + bl + (-br);
            const gy = tl + 2 * t + tr + (-bl) + -2 * b + (-br);

            const a = gx !== 0 ? matan(gy / gx) : matan(Infinity);

            const minLuma = mmin(tl, tl, tr, l, c, r, bl, b, br);
            const maxLuma = mmax(tl, tl, tr, l, c, r, bl, b, br);

            const deltaLuma = maxLuma - minLuma;

            if (deltaLuma < mmax(0.0312, 0.125 * maxLuma)) {
                writeRGB[i32] = readRGB32[i32];
                continue;
            }

            if (a !== 0) { 
                // debugger; 
                // console.log(a);
                (window as any).abc.push(a * 180 / Math.PI)
            }
        }
    }

    return rgbView;
}

function perlinParticlesRGB2(node: Node, env: Environment): View {

    const { r: lR, g: lG, b: lB } = evalNode(node.args[0] as Node, env) as Color;
    const { r: rR, g: rG, b: rB } = evalNode(node.args[1] as Node, env) as Color;

    const minParticles = 500;
    const maxParticles = 5000;

    const minSteps = 500;
    const maxSteps = 1000;

    const numParticles = env.getRandom() * (maxParticles - minParticles) + minParticles;
    const numSteps = env.getRandom() * (maxSteps - minSteps) + minSteps;
    const fade = env.getRandom() / 2 + .25;
    const angularVelocity = env.getRandom() * 5;

    const outRGBView = env.newRGBView();
    const writeRGB = outRGBView.write;

    const height = env.height;
    const width = env.width;

    const zoom = env.getRandom() * 3 + 1;

    const f = seed(env.getRandom(), perlin2);

    for (let i = 0; i < numParticles; i++) {

        let x = env.getRandom() * width;
        let y = env.getRandom() * height;
        const a = env.getRandom() * tau;

        writeRGB[mfloor(y) * width + mfloor(x)] = 
            -16777216 |
            (mround(lB * 255) << 16) |
            (mround(lG * 255) << 8) |
            mround(lR * 255);

        for (let s = 0; s < numSteps; s++) {

            const p = ((numSteps - s) / numSteps);

            const d = f(x / width * zoom, y / height * zoom);
            const a = d * tau * angularVelocity;

            const v = p //* fade;
            const iv = 1 - v;

            x += mcos(a);
            y += msin(a);

            writeRGB[mfloor(y) * width + mfloor(x)] = 
                -16777216 |
                (mround((lB * v + rB * iv) * 255) << 16) |
                (mround((lG * v + rG * iv) * 255) << 8) |
                (mround(lR * v + rR * iv) * 255);
        }
    }

    return outRGBView;
}

function perlinParticles3(node: Node, env: Environment): View {

    const minParticles = 100;
    const maxParticles = 1000;

    const minSteps = 100;
    const maxSteps = 2000;

    const numParticles = env.getRandom() * (maxParticles - minParticles) + minParticles;
    const numSteps = env.getRandom() * (maxSteps - minSteps) + minSteps;
    const fade = env.getRandom();
    const angularVelocity = env.getRandom() * 5;

    const outBWView = env.newBWView();
    const writeBW = outBWView.write;

    const height = env.height;
    const width = env.width;

    const zoom = env.getRandom() * 3 + 1;

    const f = seed(env.getRandom(), perlin3);

    for (let i = 0; i < numParticles; i++) {

        let x = env.getRandom() * width;
        let y = env.getRandom() * height;
        const a = env.getRandom() * tau;

        let v = 1.0;

        writeBW[mfloor(y) * width + mfloor(x)] = v;

        for (let s = 0; s < numSteps; s++) {

            const p = ((numSteps - s) / numSteps);

            const d = f(x / width * zoom, y / height * zoom, p);
            const a = d * tau * angularVelocity;

            const sf = p * fade;

            x += mcos(a);
            y += msin(a);

            writeBW[mfloor(y) * width + mfloor(x)] = v * sf;
        }
    }

    return outBWView;
}

function perlinParticles2(node: Node, env: Environment): View {

    const minParticles = 500;
    const maxParticles = 5000;

    const minSteps = 500;
    const maxSteps = 1000;

    const numParticles = env.getRandom() * (maxParticles - minParticles) + minParticles;
    const numSteps = env.getRandom() * (maxSteps - minSteps) + minSteps;
    const fade = env.getRandom();
    const angularVelocity = env.getRandom() * 5;

    const outBWView = env.newBWView();
    const writeBW = outBWView.write;

    const height = env.height;
    const width = env.width;

    const zoom = env.getRandom() * 3 + 1;

    const f = seed(env.getRandom(), perlin2);

    for (let i = 0; i < numParticles; i++) {

        let x = env.getRandom() * width;
        let y = env.getRandom() * height;
        let a = env.getRandom() * tau;

        let v = 1.0;

        writeBW[mfloor(y) * width + mfloor(x)] = v;

        for (let s = 0; s < numSteps; s++) {

            const d = f(x / width * zoom, y / height * zoom);
            let aa = d * tau * angularVelocity;

            const sf = ((numSteps - s) / numSteps) * fade;

            x += mcos(aa);
            y += msin(aa);

            writeBW[mfloor(y) * width + mfloor(x)] = v * sf;
        }
    }

    return outBWView;
}

function perlinParticleSteams2(node: Node, env: Environment): View {

    const minParticles = 500;
    const maxParticles = 5000;

    const minSteps = 500;
    const maxSteps = 1000;

    const numParticles = env.getRandom() * (maxParticles - minParticles) + minParticles;
    const numSteps = env.getRandom() * (maxSteps - minSteps) + minSteps;
    const fade = env.getRandom();
    const angularVelocity = env.getRandom() * 5;

    const outBWView = env.newBWView();
    const writeBW = outBWView.write;

    const height = env.height;
    const width = env.width;

    const zoom = env.getRandom() * 3 + 1;

    const f = seed(env.getRandom(), perlin2);

    for (let i = 0; i < numParticles; i++) {

        let x = env.getRandom() * width;
        let y = env.getRandom() * height;
        let a = env.getRandom() * tau;

        let v = 1.0;

        writeBW[mfloor(y) * width + mfloor(x)] = v;

        for (let s = 0; s < numSteps; s++) {

            const d = f(x / width * zoom, y / height * zoom);
            a = d * tau * angularVelocity + a;

            const sf = ((numSteps - s) / numSteps) * fade;

            x += mcos(a);
            y += msin(a);

            writeBW[mfloor(y) * width + mfloor(x)] = v * sf;
        }
    }

    return outBWView;
}

function radialGrad(node: Node, env: Environment): RGBView {
    
    const { r: lR, g: lG, b: lB } = evalNode(node.args[0] as Node, env) as Color;
    const { r: rR, g: rG, b: rB } = evalNode(node.args[1] as Node, env) as Color;

    const rgbView = env.newRGBView();
    const writeRGB = rgbView.write;

    const height = env.height;
    const width = env.width;
    
    for (let x = 0; x < width; x++) {

        const xx = x / width * 2 - 1;

        for (let y = 0; y < height; y++) {

            const yy = y / height * 2 - 1;

            const ip = msqrt(xx * xx + yy * yy);
            const p = 1 - ip;

            writeRGB[y * width + x] =
                -16777216 |
                (mround((lB * p + rB * ip) * 255) << 16) |
                (mround((lG * p + rG * ip) * 255) << 8) |
                mround((lR * p + rR * ip) * 255);
        }
    }

    return rgbView;
}

// Parameterized color (x, y, z)
// Perlin particles (fade, steps, c1, c2)
// 

// function perlinMapRGB(node: Node, env: Environment): View {

//     const maxLevels = 15;

//     const n = env.getRandom() * maxLevels;
//     const s = env.getRandom() / n * 2;

//     const a = env.getRandom() * -10;
//     const z = env.getRandom() * 4 + 1;

//     const rgbView = env.newRGBView();
//     const writeRGB = rgbView.write;

//     const height = env.height;
//     const width = env.width;

//     const f = seed(env.getRandom(), perlin2);

//     for (let x = 0; x < width; x++) {

//         const xx = x / width * 2 - 1;

//         for (let y = 0; y < height; y++) {

//             const yy = y / height * 2 - 1;

//             const i = f(xx * z, yy * z)
//             const ip = 1 / (1 + mepow(a * i));
//             const p = 1 - ip;

//             writeRGB[y * width + x] =
//                 -16777216 |
//                 (mround((lB * p + rB * ip) * 255) << 16) |
//                 (mround((lG * p + rG * ip) * 255) << 8) |
//                 mround((lR * p + rR * ip) * 255);
//         }
//     }

//     return rgbView;
// }

function perlinRGB(node: Node, env: Environment): View {

    const { r: lR, g: lG, b: lB } = node.args[0]
        ? evalNode(node.args[0] as Node, env) as Color
        : {
            r: env.getRandom(),
            g: env.getRandom(),
            b: env.getRandom(),
        };

    const { r: rR, g: rG, b: rB } = node.args[1]
        ? evalNode(node.args[1] as Node, env) as Color
        : {
            r: env.getRandom(),
            g: env.getRandom(),
            b: env.getRandom(),
        };

    const a = env.getRandom() * -10;
    const z = env.getRandom() * 4 + 1;

    const rgbView = env.newRGBView();
    const writeRGB = rgbView.write;

    const height = env.height;
    const width = env.width;

    const f = seed(env.getRandom(), perlin2);

    for (let x = 0; x < width; x++) {

        const xx = x / width * 2 - 1;

        for (let y = 0; y < height; y++) {

            const yy = y / height * 2 - 1;

            const i = f(xx * z, yy * z)
            const ip = 1 / (1 + mepow(a * i));
            const p = 1 - ip;

            writeRGB[y * width + x] =
                -16777216 |
                (mround((lB * p + rB * ip) * 255) << 16) |
                (mround((lG * p + rG * ip) * 255) << 8) |
                mround((lR * p + rR * ip) * 255);
        }
    }

    return rgbView;
}

function simplex(node: Node, env: Environment): View {

    const outBWView = env.newBWView();
    const writeBW = outBWView.write;

    const height = env.height;
    const width = env.width;

    const a = env.getRandom() * -10;
    const z = env.getRandom() * 4 + 1;

    const f = seed(env.getRandom(), simplex2);

    for (let x = 0; x < width; x++) {

        const xx = x / width * 2 - 1;

        for (let y = 0; y < height; y++) {

            const yy = y / height * 2 - 1;

            writeBW[y * width + x] = 1 / (1 + mepow(a * f(xx * z, yy * z)));
        }
    }
    console.log(outBWView)
    return outBWView;
}

function perlin(node: Node, env: Environment): View {

    const outBWView = env.newBWView();
    const writeBW = outBWView.write;

    const height = env.height;
    const width = env.width;

    const a = env.getRandom() * -10;
    const z = env.getRandom() * 4 + 1;

    const f = seed(env.getRandom(), perlin2);

    for (let x = 0; x < width; x++) {

        const xx = x / width * 2 - 1;

        for (let y = 0; y < height; y++) {

            const yy = y / height * 2 - 1;

            writeBW[y * width + x] = 1 / (1 + mepow(a * f(xx * z, yy * z)));
        }
    }

    return outBWView;
}

function ripple(node: Node, env: Environment): View {

    const right = evalNode(node.args[0] as Node, env) as View;
    const rgbView = toRGBView(env, right);

    const readRGB = rgbView.write;

    const outRGBView = env.newRGBView();
    const writeRGB = outRGBView.write;
    writeRGB.fill(-16777216);

    const i = env.getRandom() * 25;

    const height = env.height;
    const width = env.width;

    for (let x = 0; x < width; x++) {

        const xx = x / width * 2 - 1;

        for (let y = 0; y < height; y++) {

            const yy = y / height * 2 - 1;
    
            const c = mcos(xx * i);

            let u = mround((xx + 1) / 2 * width);
            let v = mround((c * xx + yy + 1) / 2 * height);

            u = mmin(mmax(0, u), width - 1);
            v = mmin(mmax(0, v), height - 1);

            // if (u >= 0 && v >= 0 && u < width && v < height) {
                writeRGB[y * width + x] = readRGB[v * width + u];
            // }
        }
    }

    return outRGBView;
}

function buldge(node: Node, env: Environment): View {

    const left = evalNode(node.args[0] as Node, env) as number;
    const coef = left * 2 - 1;

    const right = evalNode(node.args[1] as Node, env) as View;
    const rgbView = toRGBView(env, right);

    const readRGB = rgbView.write;

    const outRGBView = env.newRGBView();
    const writeRGB = outRGBView.write;
    writeRGB.fill(-16777216);

    const height = env.height;
    const width = env.width;

    for (let x = 0; x < width; x++) {

        const xx = x / width * 2 - 1;

        for (let y = 0; y < height; y++) {

            const yy = y / height * 2 - 1;

            const r = xx * xx + yy * yy;
            const rcoef = mpow(r, coef);

            let u = mround((rcoef * xx + 1) / 2 * width);
            let v = mround((rcoef * yy + 1) / 2 * height);

            u = mmin(mmax(0, u), width - 1);
            v = mmin(mmax(0, v), height - 1);

            // if (u >= 0 && v >= 0 && u < width && v < height) {
                writeRGB[y * width + x] = readRGB[v * width + u];
            // }
        }
    }

    return outRGBView;
}

function swirl(node: Node, env: Environment): View {

    const left = evalNode(node.args[0] as Node, env) as number;
    const theta = left * Math.PI * 2 * 3;

    const right = evalNode(node.args[1] as Node, env) as View;
    const rgbView = toRGBView(env, right);

    const readRGB = rgbView.write;

    const outRGBView = env.newRGBView();
    const writeRGB = outRGBView.write;
    writeRGB.fill(-16777216);

    const height = env.height;
    const width = env.width;

    for (let x = 0; x < width; x++) {

        const xx = x / width * 2 - 1;

        for (let y = 0; y < height; y++) {

            const yy = y / height * 2 - 1;

            const thetap = msqrt(xx * xx + yy * yy) * theta;

            let u = mround(((xx * mcos(thetap) - yy * msin(thetap)) + 1) / 2 * width);
            let v = mround(((xx * msin(thetap) + yy * mcos(thetap)) + 1) / 2 * height);

            u = mmin(mmax(0, u), width - 1);
            v = mmin(mmax(0, v), height - 1);

            // if (u >= 0 && v >= 0 && u < width && v < height) {
                writeRGB[y * width + x] = readRGB[v * width + u];
            // }
        }
    }

    return outRGBView;
}

function rotate(node: Node, env: Environment): View {

    const left = evalNode(node.args[0] as Node, env) as number;
    const theta = left * Math.PI * 2;

    const right = evalNode(node.args[1] as Node, env) as View;
    const rgbView = toRGBView(env, right);

    const readRGB = rgbView.write;

    const outRGBView = env.newRGBView();
    const writeRGB = outRGBView.write;

    const height = env.height;
    const width = env.width;

    for (let x = 0; x < width; x++) {

        const xx = x / width * 2 - 1;

        for (let y = 0; y < height; y++) {

            const yy = y / height * 2 - 1;

            let u = mround(((xx * mcos(theta) - yy * msin(theta)) + 1) / 2 * width);
            let v = mround(((xx * msin(theta) + yy * mcos(theta)) + 1) / 2 * height);

            u = mmin(mmax(0, u), width - 1);
            v = mmin(mmax(0, v), height - 1);
        
            writeRGB[y * width + x] = readRGB[v * width + u];
        }
    }

    return outRGBView;
}

function filter(node: Node, env: Environment): View {

    const operand = evalNode(node.args[0] as Node, env);
    const inRGBView = toRGBView(env, operand);
    const readRGB = inRGBView.read;

    const outRGBView = env.newRGBView();
    const writeRGB = outRGBView.write;

    const range = 2;

    const filterCoeficients = [
        [(env.getRandom() * range) - range / 2, (env.getRandom() * range) - range / 2, (env.getRandom() * range) - range / 2],
        [(env.getRandom() * range) - range / 2, (env.getRandom() * range) - range / 2, (env.getRandom() * range) - range / 2],
        [(env.getRandom() * range) - range / 2, (env.getRandom() * range) - range / 2, (env.getRandom() * range) - range / 2],
        // [1, 1, 1],
        // [1, 9, 1],
        // [1, 1, 1],
    ];
    console.log(filterCoeficients)
    const height = env.height;
    const width = env.width;
    const adjHeight = height - 1;
    const adjWidth = width - 1;

    for (let x = 1; x < adjWidth; x++) {
        for (let y = 1; y < adjHeight; y++) {

            let r = 0;
            let g = 0;
            let b = 0;

            for (let u = -1; u < 2; u++) {

                const uvx = x + u;

                for (let v = -1; v < 2; v++) {

                    const uvy = y + v;

                    let uv8 = (uvy * width + uvx) * 4;

                    const filterCoeficient = filterCoeficients[u + 1][v + 1];

                    r += readRGB[uv8] * filterCoeficient;
                    g += readRGB[++uv8] * filterCoeficient;
                    b += readRGB[++uv8] * filterCoeficient;
                }
            }

            writeRGB[y * width + x] =
                -16777216 |
                (mmin(mmax(mround(b), 0), 255) << 16) |
                (mmin(mmax(mround(g), 0), 255) << 8) |
                mmin(mmax(mround(r), 0), 255);
        }
    }

    return outRGBView;
}

// xn+1 = a xn + b yn + c
// yn+1 = d xn + e yn + f
function ifs(node: Node, env: Environment): BWView {

    const bwView = env.newBWView();
    const writeBW = bwView.write;
    const readBW = bwView.read;

    const height = env.height;
    const width = env.width;

    let ifsSets: number[][];

    const getRandom = env.getRandom;

    const n = 2 + Math.round(getRandom() * 3);

    let isContractive = false;

    while (!isContractive) {

        let contractive = true;
        ifsSets = [];

        for (let i = 0; i < n; i++) {
            
            const set = [
                getRandom() * 2 - 1,
                getRandom() * 2 - 1,
                getRandom() * 2 - 1,
                getRandom() * 2 - 1,
                getRandom() * 2 - 1,
                getRandom() * 2 - 1,
            ];

            ifsSets.push(set);

            const ad = set[0] * set[0] + set[3] * set[3];
            const be = set[1] * set[1] + set[4] * set[4];
            const aedb = set[0] * set[4] - set[1] * set[3];

            contractive = contractive 
                && ad < 1
                && be < 1
                && ad + be < 1 + aedb * aedb;
        }

        isContractive = contractive;
    }

    let x = 0;
    let y = 0;

    const iterations = readBW.length / 10;
    for (let i = 0; i < iterations; i++) {

        const si = mfloor(getRandom() * n)
        const ifsSet = ifsSets[si];
        const xo = x;

        x = ifsSet[0] * xo + ifsSet[1] * y + ifsSet[2];
        y = ifsSet[3] * xo + ifsSet[4] * y + ifsSet[5];

        const xx = mround((x + 1) / 2 * width);
        const yy = mround((y + 1) / 2 * height);
        
        writeBW[yy * width + xx] = 1.0;
    }

    return bwView;
}

function blur(node: Node, env: Environment): View {

    const operand = wrapWithType(evalNode(node.args[0] as Node, env));

    if (operand.type !== PrimaryType.View || (operand.value as View).type === ViewType.RGB) {
        
        const sourceRGBView = toRGBView(env, operand.value);
    
        const rgbView = env.newRGBView();
        const writeRGB = rgbView.write;
        let readRGB = sourceRGBView.read;

        const height = env.height;
        const width = env.width;

        for (let i = 0; i < 1; i++) {
            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
        
                    let r = 0;
                    let g = 0;
                    let b = 0;

                    let p = 0;
        
                    for (let u = -1; u < 2; u++) {

                        const uvx = x + u;

                        for (let v = -1; v < 2; v++) {
                            
                            const uvy = y + v;

                            // Could be unraveled more to handle special cases
                            // for each corner and the sides, but perf diff is too small right now...
                            if (uvx > -1 && uvx < width && uvy > -1 && uvy < width) {

                                let uv8 = (uvy * width + uvx) * 4;
            
                                r += readRGB[uv8];
                                g += readRGB[++uv8];
                                b += readRGB[++uv8];

                                p++;
                            }
                        }
                    }
        
                    r /= p;
                    g /= p;
                    b /= p;
        
                    writeRGB[y * width + x] =
                        -16777216 |
                        (mround(b) << 16) |
                        (mround(g) << 8) |
                        mround(r);
                }
            }

            readRGB = rgbView.read;
        }

        return rgbView;

    } else { // BW

        const bwView = env.newBWView();
        const writeBW = bwView.write;
        let readBW = (operand.value as BWView).read;

        const height = env.height;
        const width = env.width;

        for (let i = 0; i < 1; i++) {
            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {

                    let bw = 0;

                    let p = 0;
        
                    for (let u = -1; u < 2; u++) {

                        const uvx = x + u;

                        for (let v = -1; v < 2; v++) {
                            
                            const uvy = y + v;

                            // Could be unraveled more to handle special cases
                            // for each corner and the sides, but perf diff is too small right now...
                            if (uvx > -1 && uvx < width && uvy > -1 && uvy < width) {

                                const uv32 = uvy * width + uvx;
            
                                bw += readBW[uv32];

                                p++;
                            }
                        }
                    }
        
                    bw /= p;
        
                    writeBW[y * width + x] = bw;
                }
            }

            readBW = bwView.read;
        }

        return bwView;
    }
}

function noise(node: Node, env: Environment): RGBView {

    const rgbView = env.newRGBView();
    const writeRGB = rgbView.write;

    const height = env.height;
    const width = env.width;

    const getRandom = env.getRandom;

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {

            writeRGB[y * width + x] =
                -16777216 |
                (mround(getRandom() * 255) << 16) |
                (mround(getRandom() * 255) << 8) |
                mround(getRandom() * 255);
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
                (mround((lB * p + rB * ip) * 255) << 16) |
                (mround((lG * p + rG * ip) * 255) << 8) |
                mround((lR * p + rR * ip) * 255);
        }
    }

    return rgbView;
}

function hsvToRGB(node: Node, env: Environment): RGBView {

    const rgbView = env.newRGBView();
    const writeRGB = rgbView.write;

    const height = env.height;
    const width = env.width;

    const operand = toRGBView(env, evalNode(node.args[0] as Node, env));
    const readRGB = operand.read;

    let r, g, b, i, f, p, q, t, h, s, v;

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {

            const i32 = y * width + x;
            let i8 = i32 * 4;

            h = readRGB[i8];
            s = readRGB[++i8];
            v = readRGB[++i8];

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

            writeRGB[i32] =
                -16777216 |
                (mround(b * 255) << 16) |
                (mround(g * 255) << 8) |
                mround(r * 255);
        }
    }

    return rgbView;
}

function x(env: Environment): BWView {

    const bwView = env.newBWView();
    const writeBW = bwView.write;

    const height = env.height;
    const width = env.width;
    
    for (let x = 0; x < width; x++) {

        const xf = (x / width) * 2 - 1;

        for (let y = 0; y < height; y++) {

            const i = y * width + x;

            writeBW[i] = xf;
        }
    }

    return bwView;
}

function y(env: Environment): BWView {

    const bwView = env.newBWView();
    const writeBW = bwView.write;

    const height = env.height;
    const width = env.width;
    
    for (let y = 0; y < width; y++) {

        const yf = (y / width) * 2 - 1;

        for (let x = 0; x < height; x++) {

            const i = y * width + x;

            writeBW[i] = yf;
        }
    }

    return bwView;
}

const add: BinaryOperations = {
    bw_rgb: (l, ro, r) => -16777216 |
        ((mround(l + r[ro]) % 256) << 16) |
        ((mround(l + r[--ro]) % 256) << 8) |
        (mround(l + r[--ro]) % 256),
    bw: (l, r) => l + r,
    color: (l, r) => ({ r: (l.r + r.r) % 256, g: (l.g + r.g) % 256, b: (l.b + r.b) % 256 }),
    number: (l, r) => l + r,
    rgb_bw: (lo, l, r) => -16777216 |
        ((mround(l[lo] + r) % 256) << 16) |
        ((mround(l[--lo] + r) % 256) << 8) |
        (mround(l[--lo] + r) % 256),
    rgb: (o, l, r) => -16777216 |
        ((mround(l[o] + r[o]) % 256) << 16) |
        ((mround(l[--o] + r[o]) % 256) << 8) |
        (mround(l[--o] + r[o]) % 256),
};

const sub: BinaryOperations = {
    bw_rgb: (l, ro, r) => -16777216 |
        ((mround(l - r[ro]) % 256) << 16) |
        ((mround(l - r[--ro]) % 256) << 8) |
        (mround(l - r[--ro]) % 256),
    bw: (l, r) => l - r,
    color: (l, r) => ({ r: (l.r - r.r) % 256, g: (l.g - r.g) % 256, b: (l.b - r.b) % 256 }),
    number: (l, r) => l - r,
    rgb_bw: (lo, l, r) => -16777216 |
        ((mround(l[lo] - r) % 256) << 16) |
        ((mround(l[--lo] - r) % 256) << 8) |
        (mround(l[--lo] - r) % 256),
    rgb: (o, l, r) => -16777216 |
        ((mround(l[o] - r[o]) % 256) << 16) |
        ((mround(l[--o] - r[o]) % 256) << 8) |
        (mround(l[--o] - r[o]) % 256),
};

const mult: BinaryOperations = {
    bw_rgb: (l, ro, r) => -16777216 |
        ((mround(l * r[ro]) % 256) << 16) |
        ((mround(l * r[--ro]) % 256) << 8) |
        (mround(l * r[--ro]) % 256),
    bw: (l, r) => l * r,
    color: (l, r) => ({ r: (l.r * r.r) % 256, g: (l.g * r.g) % 256, b: (l.b * r.b) % 256 }),
    number: (l, r) => l * r,
    rgb_bw: (lo, l, r) => -16777216 |
        ((mround(l[lo] * r) % 256) << 16) |
        ((mround(l[--lo] * r) % 256) << 8) |
        (mround(l[--lo] * r) % 256),
    rgb: (o, l, r) => -16777216 |
        ((mround(l[o] * r[o]) % 256) << 16) |
        ((mround(l[--o] * r[o]) % 256) << 8) |
        (mround(l[--o] * r[o]) % 256),
};

const div: BinaryOperations = {
    bw_rgb: (l, ro, r) => -16777216 |
        ((mround(l / r[ro] * 256) % 256) << 16) |
        ((mround(l / r[--ro] * 256) % 256) << 8) |
        (mround(l / r[--ro] * 256) % 256),
    bw: (l, r) => l / r,
    color: (l, r) => ({ r: (l.r / r.r) % 256, g: (l.g / r.g) % 256, b: (l.b / r.b) % 256 }),
    number: (l, r) => l / r,
    rgb_bw: (lo, l, r) => -16777216 |
        ((mround(l[lo] / r * 256) % 256) << 16) |
        ((mround(l[--lo] / r * 256) % 256) << 8) |
        (mround(l[--lo] / r * 256) % 256),
    rgb: (o, l, r) => -16777216 |
        ((mround(l[o] / r[o] * 256) % 256) << 16) |
        ((mround(l[--o] / r[o] * 256) % 256) << 8) |
        (mround(l[--o] / r[o] * 256) % 256),
};

const pow: BinaryOperations = {
    bw_rgb: (l, ro, r) => -16777216 |
        ((mround(mpow(l, r[ro])) % 256) << 16) |
        ((mround(mpow(l, r[--ro])) % 256) << 8) |
        (mround(mpow(l, r[--ro])) % 256),
    bw: (l, r) => mpow(l, r),
    color: (l, r) => ({ r: mpow(l.r, r.r) % 256, g: mpow(l.g, r.g) % 256, b: mpow(l.b, r.b) % 256 }),
    number: (l, r) => mpow(l, r),
    rgb_bw: (lo, l, r) => -16777216 |
        ((mround(mpow(l[lo], r)) % 256) << 16) |
        ((mround(mpow(l[--lo], r)) % 256) << 8) |
        (mround(mpow(l[--lo], r)) % 256),
    rgb: (o, l, r) => -16777216 |
        ((mround(mpow(l[o], r[o])) % 256) << 16) |
        ((mround(mpow(l[--o], r[o])) % 256) << 8) |
        (mround(mpow(l[--o], r[o])) % 256),
};

const min: BinaryOperations = {
    bw_rgb: (l, ro, r) => -16777216 |
        ((mround(mmin(l, r[ro])) % 256) << 16) |
        ((mround(mmin(l, r[--ro])) % 256) << 8) |
        (mround(mmin(l / r[--ro])) % 256),
    bw: (l, r) => mmin(l, r),
    color: (l, r) => ({ r: mmin(l.r, r.r) % 256, g: mmin(l.g, r.g) % 256, b: mmin(l.b, r.b) % 256 }),
    number: (l, r) => mmin(l, r),
    rgb_bw: (lo, l, r) => -16777216 |
        ((mround(mmin(l[lo], r)) % 256) << 16) |
        ((mround(mmin(l[--lo], r)) % 256) << 8) |
        (mround(mmin(l[--lo], r)) % 256),
    rgb: (o, l, r) => -16777216 |
        ((mround(mmin(l[o], r[o])) % 256) << 16) |
        ((mround(mmin(l[--o], r[o])) % 256) << 8) |
        (mround(mmin(l[--o], r[o])) % 256),
};

const max: BinaryOperations = {
    bw_rgb: (l, ro, r) => -16777216 |
        ((mround(mmax(l, r[ro])) % 256) << 16) |
        ((mround(mmax(l, r[--ro])) % 256) << 8) |
        (mround(mmax(l / r[--ro])) % 256),
    bw: (l, r) => mmax(l, r),
    color: (l, r) => ({ r: mmax(l.r, r.r) % 256, g: mmax(l.g, r.g) % 256, b: mmax(l.b, r.b) % 256 }),
    number: (l, r) => mmax(l, r),
    rgb_bw: (lo, l, r) => -16777216 |
        ((mround(mmax(l[lo], r)) % 256) << 16) |
        ((mround(mmax(l[--lo], r)) % 256) << 8) |
        (mround(mmax(l[--lo], r)) % 256),
    rgb: (o, l, r) => -16777216 |
        ((mround(mmax(l[o], r[o])) % 256) << 16) |
        ((mround(mmax(l[--o], r[o])) % 256) << 8) |
        (mround(mmax(l[--o], r[o])) % 256),
};

const mod: BinaryOperations = {
    bw_rgb: (l, ro, r) => -16777216 |
        ((mround(l % r[ro] * 256) % 256) << 16) |
        ((mround(l % r[--ro] * 256) % 256) << 8) |
        (mround(l % r[--ro] * 256) % 256),
    bw: (l, r) => l % r,
    color: (l, r) => ({ r: (l.r % r.r) % 256, g: (l.g % r.g) % 256, b: (l.b % r.b) % 256 }),
    number: (l, r) => l % r,
    rgb_bw: (lo, l, r) => -16777216 |
        ((mround(l[lo] % r * 256) % 256) << 16) |
        ((mround(l[--lo] % r * 256) % 256) << 8) |
        (mround(l[--lo] % r * 256) % 256),
    rgb: (o, l, r) => -16777216 |
        ((mround(l[o] % r[o] * 256) % 256) << 16) |
        ((mround(l[--o] % r[o] * 256) % 256) << 8) |
        (mround(l[--o] % r[o] * 256) % 256),
};

const cross: BinaryOperations = {
    bw_rgb: (l, ro, r) => {

        const rB = r[ro];
        const rG = r[--ro];
        const rR = r[--ro];

        return -16777216 |
            ((mround(l * rG - l * rR) % 256) << 16) |
            ((mround(l * rR - l * rB) % 256) << 8) |
            (mround(l * rB - l * rG) % 256);
    },
    bw: (l, r) => 0,
    color: (l, r) => ({
        r: (l.g * r.b - l.b * r.g) % 256,
        g: (l.b * r.r - l.r * r.b) % 256,
        b: (l.r * r.g - l.g * r.r) % 256,
     }),
    number: (l, r) => 0,
    rgb_bw: (lo, l, r) => {

        const lB = l[lo];
        const lG = l[--lo];
        const lR = l[--lo];

        return -16777216 |
            ((mround(lG * r - lB * r) % 256) << 16) |
            ((mround(lB * r - lR * r) % 256) << 8) |
            (mround(lR * r - lG * r) % 256);
    },
    rgb: (o, l, r) => {

        const lB = l[o];
        const rB = r[o];
        const lG = l[--o];
        const rG = r[o];
        const lR = l[--o];
        const rR = r[o];

        return -16777216 |
            ((mround(lG * rG - lB * rR) % 256) << 16) |
            ((mround(lB * rR - lR * rB) % 256) << 8) |
            (mround(lR * rB - lG * rG) % 256);
    },
};

const cos: UnaryOperations = {
    bw: op => mcos(op * tau),
    color: op => ({ r: (mcos(op.r * tau) + 1) / 2 * 255, g: (mcos(op.g * tau) + 1) / 2 * 255, b: (mcos(op.b * tau) + 1) / 2 * 255 }),
    number: op => mcos(op * tau),
    rgb: (o, op) => -16777216 |
        (mround((mcos(op[o] / 255 * tau) + 1) / 2 * 255) << 16) |
        (mround((mcos(op[--o] / 255 * tau) + 1) / 2 * 255) << 8) |
        mround((mcos(op[--o] / 255 * tau) + 1) / 2 * 255),
};

const sin: UnaryOperations = {
    bw: op => msin(op * tau),
    color: op => ({ r: (msin(op.r * tau) + 1) / 2 * 255, g: (msin(op.g * tau) + 1) / 2 * 255, b: (msin(op.b * tau) + 1) / 2 * 255 }),
    number: op => msin(op * tau),
    rgb: (o, op) => -16777216 |
        (mround((msin(op[o] / 255 * tau) + 1) / 2 * 255) << 16) |
        (mround((msin(op[--o] / 255 * tau) + 1) / 2 * 255) << 8) |
        mround((msin(op[--o] / 255 * tau) + 1) / 2 * 255),
};

const tan: UnaryOperations = {
    bw: op => mtan(op * tau),
    color: op => ({ r: (mtan(op.r * tau) + 1) / 2 * 255, g: (mtan(op.g * tau) + 1) / 2 * 255, b: (mtan(op.b * tau) + 1) / 2 * 255 }),
    number: op => mtan(op * tau),
    rgb: (o, op) => -16777216 |
        (mround((mtan(op[o] / 255 * tau) + 1) / 2 * 255) << 16) |
        (mround((mtan(op[--o] / 255 * tau) + 1) / 2 * 255) << 8) |
        mround((mtan(op[--o] / 255 * tau) + 1) / 2 * 255),
};

const log: UnaryOperations = {
    bw: op => op !== 0 ? mlog(op) : 0,
    color: op => ({ r: (op.r !== 0 ? mlog(op.r) * 256 : 0) % 255, g: (op.g !== 0 ? mlog(op.g) * 256 : 0) % 255, b: (op.b !== 0 ? mlog(op.b) * 256 : 0) % 255 }),
    number: op => op !== 0 ? mlog(op) : 0,
    rgb: (o, op) => -16777216 |
        (mround((op[o] !== 0 ? mlog(op[o]) * 256 : 0) % 256) << 16) |
        (mround((op[--o] !== 0 ? mlog(op[o]) * 256 : 0) % 256) << 8) |
        mround((op[--o] !== 0 ? mlog(op[o]) * 256 : 0) % 256),
};

const round: UnaryOperations = {
    bw: op => mround(op),
    color: op => ({ r: mround(op.r), g: mround(op.r), b: mround(op.b) }),
    number: op => mround(op),
    rgb: (o, op) => -16777216 |
        (mround(op[o]) << 16) |
        (mround(op[--o]) << 8) |
        mround(op[--o]),
};

const abs: UnaryOperations = {
    bw: op => mabs(op),
    color: op => ({ r: mabs(op.r), g: mabs(op.r), b: mabs(op.b) }),
    number: op => mabs(op),
    rgb: (o, op) => -16777216 |
        (mabs(op[o]) << 16) |
        (mabs(op[--o]) << 8) |
        mabs(op[--o]),
};

const geneticTextureEval = {
    [GeneticTexture.X]: (node, env) => x(env),
    [GeneticTexture.Y]: (node, env) => y(env),
    [GeneticTexture.Color]: node => node.args[0],
    [GeneticTexture.Const]: node => node.args[0],
    [GeneticTexture.Add]: (node, env) => binaryElementWiseExpression(node, env, add),
    [GeneticTexture.Sub]: (node, env) => binaryElementWiseExpression(node, env, sub),
    [GeneticTexture.Mult]: (node, env) => binaryElementWiseExpression(node, env, mult),
    [GeneticTexture.Div]: (node, env) => binaryElementWiseExpression(node, env, div),
    [GeneticTexture.Pow]: (node, env) => binaryElementWiseExpression(node, env, pow),
    [GeneticTexture.Cos]: (node, env) => unaryExpression(node, env, cos),
    [GeneticTexture.Sin]: (node, env) => unaryExpression(node, env, sin),
    [GeneticTexture.Log]: (node, env) => unaryExpression(node, env, log),
    [GeneticTexture.Min]: (node, env) => binaryElementWiseExpression(node, env, min),
    [GeneticTexture.Max]: (node, env) => binaryElementWiseExpression(node, env, max),
    [GeneticTexture.Cross]: (node, env) => binaryElementWiseExpression(node, env, cross),
    [GeneticTexture.Round]: (node, env) => unaryExpression(node, env, round),
    [GeneticTexture.Abs]: (node, env) => unaryExpression(node, env, abs),
    [GeneticTexture.Noise]: noise,
    [GeneticTexture.Grad]: grad,
    [GeneticTexture.Blur]: blur,
    [GeneticTexture.Filter]: filter,
    [GeneticTexture.HSVtoRGB]: hsvToRGB,
    [GeneticTexture.Mod]: (node, env) => binaryElementWiseExpression(node, env, mod),
    [GeneticTexture.Ifs]: ifs,
    [GeneticTexture.Rotate]: rotate,
    [GeneticTexture.Swirl]: swirl,
    [GeneticTexture.Buldge]: buldge,
    [GeneticTexture.PerlinNoise]: perlin,
    [GeneticTexture.SimplexNoise]: simplex,
    [GeneticTexture.PerlinRGBNoise]: perlinRGB,
    [GeneticTexture.RadialGrad]: radialGrad,
    [GeneticTexture.PerlinRandomRGBNoise]: perlinRGB,
    [GeneticTexture.PerlinParticles2]: perlinParticles2,
    [GeneticTexture.PerlinParticles3]: perlinParticles3,
    [GeneticTexture.PerlinParticleStreams]: perlinParticleSteams2,
    [GeneticTexture.PerlinParticlesRGB2]: perlinParticlesRGB2,
    [GeneticTexture.Ripple]: ripple,
    [GeneticTexture.CCFXAA]: ccfxaa,
    [GeneticTexture.Tan]: (node, env) => unaryExpression(node, env, tan),
};

const geneticTextureDef = {
    [GeneticTexture.X]: { name: 'X', args: [], return: PrimaryType.View },
    [GeneticTexture.Y]: { name: 'Y', args: [], return: PrimaryType.View },
    [GeneticTexture.Color]: { name: 'Color', args: [], return: PrimaryType.Color },
    [GeneticTexture.Const]: { name: 'Const', args: [], return: PrimaryType.Number },
    [GeneticTexture.Add]: { name: 'Add', args: [PrimaryType.View, PrimaryType.View], return: PrimaryType.View },
    [GeneticTexture.Sub]: { name: 'Sub', args: [PrimaryType.View, PrimaryType.View], return: PrimaryType.View },
    [GeneticTexture.Mult]: { name: 'Mult', args: [PrimaryType.View, PrimaryType.View], return: PrimaryType.View },
    [GeneticTexture.Div]: { name: 'Div', args: [PrimaryType.View, PrimaryType.View], return: PrimaryType.View },
    [GeneticTexture.Pow]: { name: 'Pow', args: [PrimaryType.View, PrimaryType.View], return: PrimaryType.View },
    [GeneticTexture.Cos]: { name: 'Cos', args: [PrimaryType.View], return: PrimaryType.View },
    [GeneticTexture.Sin]: { name: 'Sin', args: [PrimaryType.View], return: PrimaryType.View },
    [GeneticTexture.Log]: { name: 'Log', args: [PrimaryType.View], return: PrimaryType.View },
    [GeneticTexture.Min]: { name: 'Min', args: [PrimaryType.View, PrimaryType.View], return: PrimaryType.View },
    [GeneticTexture.Max]: { name: 'Max', args: [PrimaryType.View, PrimaryType.View], return: PrimaryType.View },
    [GeneticTexture.Cross]: { name: 'Cross', args: [PrimaryType.View, PrimaryType.View], return: PrimaryType.View },
    [GeneticTexture.Round]: { name: 'Round', args: [PrimaryType.View], return: PrimaryType.View },
    [GeneticTexture.Abs]: { name: 'Abs', args: [PrimaryType.View], return: PrimaryType.View },
    // [GeneticTexture.Noise]: { name: 'Noise', args: [], return: PrimaryType.View },
    [GeneticTexture.Grad]: { name: 'Grad', args: [PrimaryType.Color, PrimaryType.Color], return: PrimaryType.View },
    [GeneticTexture.Blur]: { name: 'Blur', args: [PrimaryType.View], return: PrimaryType.View },
    [GeneticTexture.Filter]: { name: 'Filter', args: [PrimaryType.View], return: PrimaryType.View },
    [GeneticTexture.HSVtoRGB]: { name: 'HSVtoRGB', args: [PrimaryType.View], return: PrimaryType.View },
    [GeneticTexture.Mod]: { name: 'Mod', args: [PrimaryType.View, PrimaryType.View], return: PrimaryType.View },
    // [GeneticTexture.Ifs]: { name: 'Ifs', args: [], return: PrimaryType.View },
    // [GeneticTexture.Rotate]: { name: 'Rotate', args: [PrimaryType.Number, PrimaryType.View], return: PrimaryType.View },
    // [GeneticTexture.Swirl]: { name: 'Swirl', args: [PrimaryType.Number, PrimaryType.View], return: PrimaryType.View },
    // [GeneticTexture.Buldge]: { name: 'Buldge', args: [PrimaryType.Number, PrimaryType.View], return: PrimaryType.View },
    // [GeneticTexture.PerlinNoise]: { name: 'PerlinNoise', args: [], return: PrimaryType.View },
    // [GeneticTexture.SimplexNoise]: { name: 'SimplexNoise', args: [], return: PrimaryType.View },
    // [GeneticTexture.PerlinRGBNoise]: { name: 'PerlinRGBNoise', args: [PrimaryType.Color, PrimaryType.Color], return: PrimaryType.View },
    [GeneticTexture.RadialGrad]: { name: 'RadialGrad', args: [PrimaryType.Color, PrimaryType.Color], return: PrimaryType.View },
    // [GeneticTexture.PerlinRandomRGBNoise]: { name: 'PerlinRandomRGBNoise', args: [], return: PrimaryType.View },
    // [GeneticTexture.PerlinParticles2]: { name: 'PerlinParticles2', args: [], return: PrimaryType.View },
    // [GeneticTexture.PerlinParticles3]: { name: 'PerlinParticles3', args: [], return: PrimaryType.View },
    // [GeneticTexture.PerlinParticleStreams]: { name: 'PerlinParticleStreams', args: [], return: PrimaryType.View },
    // [GeneticTexture.PerlinParticlesRGB2]: { name: 'PerlinParticlesRGB2', args: [PrimaryType.Color, PrimaryType.Color], return: PrimaryType.View },
    [GeneticTexture.Ripple]: { name: 'Ripple', args: [PrimaryType.View], return: PrimaryType.View },
    // [GeneticTexture.CCFXAA]: { name: 'CCFXAA', args: [PrimaryType.View], return: PrimaryType.View },
    [GeneticTexture.Tan]: { name: 'Tan', args: [PrimaryType.View], return: PrimaryType.View },
};

const primaryTypes = [ PrimaryType.Any, PrimaryType.Color, PrimaryType.Number, PrimaryType.View ];
const geneticTextureReturns = {};
for (const primaryType of primaryTypes) {
    geneticTextureReturns[primaryType] = Object
        .entries(geneticTextureDef)
        .map(kvp => Object.assign({ type: +kvp[0] }, kvp[1]))
        .filter((textureDef: any) => primaryType === PrimaryType.Any
            || textureDef.return === PrimaryType.Any
            || textureDef.return === primaryType
        );
}

function evalNode(node: Node, environment: Environment): Primary {
    return (geneticTextureEval[node.texture] as any)(node, environment);
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

            const bwValue = mround((bwRead[i] + 1) / 2 * 255);

            writeRGB[i] = 
                -16777216 |
                (bwValue << 16) |
                (bwValue << 8) |
                bwValue;
        }
    }

    return rgbView;
}

export function renderEvoArt(context: CanvasRenderingContext2D, evoArt: EvoArt, width: number, height: number): void {
        
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

    const rgbView = toRGBView(env, view);
    console.log(view, rgbView)
    imageData.data.set(rgbView.read);

    context.putImageData(imageData, 0, 0);

    console.log(performance.now() - start)
}

export function generateRandomEvoArt(maxDepth: number): EvoArt {

    return {
        randomSeed: Math.random(),
        root: getRandomNode(maxDepth),
    };
}

function getRandomNode(maxDepth: number, returns: PrimaryType = PrimaryType.View, depth = 0): Node {

    if (returns === PrimaryType.Color || returns === PrimaryType.Number) {
        return getTerminal(returns);
    }

    if (depth >= maxDepth - 1) {
        return getTerminal(returns);
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
                        ? getRandomType()
                        : a
                );
        }

        return randomizedArgs;

    } else if (returns === PrimaryType.View) {

        let randomizedArgs = args.slice();

        while (!randomizedArgs.some(a => a === PrimaryType.View)) {

            randomizedArgs = args
                .map(a =>
                    a === PrimaryType.Any
                        ? getRandomType()
                        : a
                );
        }

        return randomizedArgs;

    } else { // Any type works

        return args.map(a =>
            a === PrimaryType.Any
                ? getRandomType()
                : a
        );
    }
}

function getRandomType(): PrimaryType {

    const rand = Math.random();

    if (rand <= .33) {
        return PrimaryType.Color;
    } else if (rand <= .66) {
        return PrimaryType.Number;
    } else {
        return PrimaryType.View;
    }
}

function getTerminal(type: PrimaryType): Node {

    const randTerminalType = Math.random();
    
    if (type === PrimaryType.Color || (type === PrimaryType.Any && randTerminalType <= .25)) {
        console.log('Color', randTerminalType)
        return {
            texture: GeneticTexture.Color,
            args: [{
                r: Math.random(),
                g: Math.random(),
                b: Math.random(),
            }],
        };
    } else if (type === PrimaryType.Number || (type === PrimaryType.Any && randTerminalType <= .5)) {
        console.log('number', randTerminalType, type)
        return {
            texture: GeneticTexture.Const,
            args: [Math.random() * 20 - 10],
        };
    } else if (randTerminalType <= .75) {
        console.log('x', randTerminalType)
        return {
            texture: GeneticTexture.X,
            args: [],
        };
    } else {
        console.log('y', randTerminalType)
        return {
            texture: GeneticTexture.Y,
            args: [],
        };
    }
}

export function prettyPrint(node: Node): string {

    if (node.texture === GeneticTexture.Const) {
        return node.args[0].toString();
    }

    if (node.texture === GeneticTexture.Color) {
        const c = node.args[0] as Color;
        return `[${mround(c.r * 256)},${mround(c.g * 256)},${mround(c.b * 256)}]`
    }

    if (node.texture === GeneticTexture.X) {
        return 'X';
    }

    if (node.texture === GeneticTexture.Y) {
        return 'Y';
    }

    const args = node.args.map((arg: Node) => prettyPrint(arg));

    return `${geneticTextureDef[node.texture].name}( ${args.join(', ')} )`
}