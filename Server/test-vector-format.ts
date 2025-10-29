import { formatResponse } from "./services/responseFormatter";

const sampleVectorResponse = `Of course! Vectors are fundamental in many fields like physics, engineering, and computer graphics. Here is a breakdown of the most common vector calculation formulas.

Let's assume we have two 3D vectors for our examples:

• a =
<a₁, a₂, a₃>
• b =
<b₁, b₂, b₃>

## 1. Vector Magnitude (Length or Norm)

Table of contents

## 1. Vector Magnitude (Length or Norm)
## 2. Vector Addition and Subtraction
## 3. Scalar Multiplication
## 4. Dot Product (Scalar Product)
## 5. Cross Product (Vector Product)
## 6. Unit Vector

The magnitude of a vector is its length. It's a scalar (a single number) and is denoted by double vertical bars ||a|| or |a|.

Formula:
||a|| = √(a₁² + a₂² + a₃²)

Example:
If a = <3, 4, 0>, then:
||a|| = √(3² + 4² + 0²) = √(9 + 16 + 0) = √25 = 5`;

console.log("==== VECTOR CALCULATION FORMATTING ====\n");
const formatted = formatResponse(sampleVectorResponse, { emojiEnabled: true, tone: "neutral" });
console.log(formatted);
console.log("\n==== END ====");
