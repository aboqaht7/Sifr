export class ShebkaAsabiyya {
  layers: number[];
  weights: number[][][];
  biases: number[][];

  constructor(layers: number[]) {
    this.layers = layers;
    this.weights = [];
    this.biases = [];
    for (let i = 1; i < layers.length; i++) {
      this.weights.push(
        Array.from({ length: layers[i] }, () =>
          Array.from({ length: layers[i - 1] }, () => (Math.random() * 2 - 1) * 0.5)
        )
      );
      this.biases.push(Array.from({ length: layers[i] }, () => 0));
    }
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private sigmoidDeriv(activated: number): number {
    return activated * (1 - activated);
  }

  forward(input: number[]): number[][] {
    const activations: number[][] = [input];
    for (let l = 0; l < this.weights.length; l++) {
      const prev = activations[l];
      const next: number[] = [];
      for (let j = 0; j < this.weights[l].length; j++) {
        let sum = this.biases[l][j];
        for (let k = 0; k < prev.length; k++) {
          sum += prev[k] * this.weights[l][j][k];
        }
        next.push(this.sigmoid(sum));
      }
      activations.push(next);
    }
    return activations;
  }

  train(data: number[][], epochs: number, lr = 0.1): void {
    for (let e = 0; e < epochs; e++) {
      for (const sample of data) {
        const input = sample.slice(0, this.layers[0]);
        const target = sample.slice(this.layers[0]);
        const activations = this.forward(input);

        const deltas: number[][] = this.weights.map((w) => new Array(w.length).fill(0));

        // Output layer delta
        const outL = activations.length - 1;
        for (let j = 0; j < activations[outL].length; j++) {
          const err = target[j] - activations[outL][j];
          deltas[this.weights.length - 1][j] = err * this.sigmoidDeriv(activations[outL][j]);
        }

        // Hidden layers delta
        for (let l = this.weights.length - 2; l >= 0; l--) {
          for (let j = 0; j < activations[l + 1].length; j++) {
            let err = 0;
            for (let k = 0; k < this.weights[l + 1].length; k++) {
              err += deltas[l + 1][k] * this.weights[l + 1][k][j];
            }
            deltas[l][j] = err * this.sigmoidDeriv(activations[l + 1][j]);
          }
        }

        // Update weights and biases
        for (let l = 0; l < this.weights.length; l++) {
          for (let j = 0; j < this.weights[l].length; j++) {
            for (let k = 0; k < this.weights[l][j].length; k++) {
              this.weights[l][j][k] += lr * deltas[l][j] * activations[l][k];
            }
            this.biases[l][j] += lr * deltas[l][j];
          }
        }
      }
    }
  }

  predict(input: number[]): number[] {
    const activations = this.forward(input);
    return activations[activations.length - 1];
  }

  summary(): string {
    return `شبكة عصبية [${this.layers.join(' → ')}] — ${this.weights.reduce((s, w) => s + w.length * w[0].length, 0)} وزن`;
  }
}
