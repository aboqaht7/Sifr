export type Activation = 'sigmoid' | 'relu' | 'tanh' | 'softmax' | 'linear';

const ACT_AR: Record<string, Activation> = {
  'سيغمويد': 'sigmoid',
  'ريلو': 'relu',
  'ظل_زائدي': 'tanh',
  'سوفت_ماكس': 'softmax',
  'خطي': 'linear',
  'sigmoid': 'sigmoid',
  'relu': 'relu',
  'tanh': 'tanh',
  'softmax': 'softmax',
  'linear': 'linear',
};

export function normalizeActivation(a: string | undefined): Activation {
  if (!a) return 'sigmoid';
  return ACT_AR[a] ?? 'sigmoid';
}

export class ShebkaAsabiyya {
  layers: number[];
  weights: number[][][];
  biases: number[][];
  activations: Activation[];

  constructor(layers: number[], activations?: Activation[]) {
    this.layers = layers;
    const layerCount = layers.length - 1;
    this.activations = activations && activations.length === layerCount
      ? activations
      : Array.from({ length: layerCount }, (_, i) =>
          i === layerCount - 1 ? 'sigmoid' : 'relu'
        );
    this.weights = [];
    this.biases = [];
    for (let i = 1; i < layers.length; i++) {
      const fanIn = layers[i - 1];
      const act = this.activations[i - 1];
      // He init for relu, Xavier for others
      const scale = act === 'relu' ? Math.sqrt(2 / fanIn) : Math.sqrt(1 / fanIn);
      this.weights.push(
        Array.from({ length: layers[i] }, () =>
          Array.from({ length: fanIn }, () => (Math.random() * 2 - 1) * scale)
        )
      );
      this.biases.push(Array.from({ length: layers[i] }, () => 0));
    }
  }

  private apply(x: number[], act: Activation): number[] {
    switch (act) {
      case 'sigmoid': return x.map((v) => 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, v)))));
      case 'relu': return x.map((v) => (v > 0 ? v : 0));
      case 'tanh': return x.map((v) => Math.tanh(v));
      case 'softmax': {
        const max = Math.max(...x);
        const exps = x.map((v) => Math.exp(v - max));
        const sum = exps.reduce((a, b) => a + b, 0) || 1;
        return exps.map((e) => e / sum);
      }
      case 'linear': return x.slice();
    }
  }

  private deriv(activated: number, act: Activation): number {
    switch (act) {
      case 'sigmoid': return activated * (1 - activated);
      case 'relu': return activated > 0 ? 1 : 0;
      case 'tanh': return 1 - activated * activated;
      case 'softmax': return activated * (1 - activated);
      case 'linear': return 1;
    }
  }

  forward(input: number[]): number[][] {
    const acts: number[][] = [input];
    for (let l = 0; l < this.weights.length; l++) {
      const prev = acts[l];
      const z: number[] = [];
      for (let j = 0; j < this.weights[l].length; j++) {
        let sum = this.biases[l][j];
        for (let k = 0; k < prev.length; k++) sum += prev[k] * this.weights[l][j][k];
        z.push(sum);
      }
      acts.push(this.apply(z, this.activations[l]));
    }
    return acts;
  }

  train(data: number[][], epochs: number, lr = 0.1): void {
    for (let e = 0; e < epochs; e++) {
      for (const sample of data) {
        const input = sample.slice(0, this.layers[0]);
        const target = sample.slice(this.layers[0]);
        const acts = this.forward(input);

        const deltas: number[][] = this.weights.map((w) => new Array(w.length).fill(0));
        const outL = acts.length - 1;
        const outAct = this.activations[this.activations.length - 1];
        for (let j = 0; j < acts[outL].length; j++) {
          const err = (target[j] ?? 0) - acts[outL][j];
          deltas[this.weights.length - 1][j] = err * this.deriv(acts[outL][j], outAct);
        }

        for (let l = this.weights.length - 2; l >= 0; l--) {
          const act = this.activations[l];
          for (let j = 0; j < acts[l + 1].length; j++) {
            let err = 0;
            for (let k = 0; k < this.weights[l + 1].length; k++) {
              err += deltas[l + 1][k] * this.weights[l + 1][k][j];
            }
            deltas[l][j] = err * this.deriv(acts[l + 1][j], act);
          }
        }

        for (let l = 0; l < this.weights.length; l++) {
          for (let j = 0; j < this.weights[l].length; j++) {
            for (let k = 0; k < this.weights[l][j].length; k++) {
              this.weights[l][j][k] += lr * deltas[l][j] * acts[l][k];
            }
            this.biases[l][j] += lr * deltas[l][j];
          }
        }
      }
    }
  }

  predict(input: number[]): number[] {
    const acts = this.forward(input);
    return acts[acts.length - 1];
  }

  summary(): string {
    const params = this.weights.reduce(
      (s, w) => s + w.length * w[0].length + w.length, 0
    );
    return `🧠 شبكة [${this.layers.join('→')}] · ${params} مَعلَمة · تنشيط: ${this.activations.join('، ')}`;
  }

  serialize(): string {
    return JSON.stringify({
      layers: this.layers,
      weights: this.weights,
      biases: this.biases,
      activations: this.activations,
    });
  }

  static deserialize(data: string): ShebkaAsabiyya {
    const obj = JSON.parse(data) as {
      layers: number[];
      weights: number[][][];
      biases: number[][];
      activations: Activation[];
    };
    const net = new ShebkaAsabiyya(obj.layers, obj.activations);
    net.weights = obj.weights;
    net.biases = obj.biases;
    return net;
  }
}
