function luhn(cardNumber) {
  const digits = cardNumber.replace(/\D/g, '').split('').map(Number);
  if (digits.length < 2) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    if (shouldDouble) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

console.log('374251018720955:', luhn('374251018720955'));
console.log('0000000000000000:', luhn('0000000000000000'));
