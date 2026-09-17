export function isRequired(value: string): string | undefined {
  if (!value.trim()) {
    return 'This field is required';
  }
  return undefined;
}

export function validateEmail(email: string): string | undefined {
  const trimmed = email.trim();
  if (!trimmed) {
    return 'Email is required';
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return 'Enter a valid email address';
  }
  return undefined;
}

export function validatePhone(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, '');
  if (!digits) {
    return 'Phone number is required';
  }
  if (digits.length !== 10) {
    return 'Enter a valid 10-digit phone number';
  }
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (!password) {
    return 'Password is required';
  }
  if (password.length < 6) {
    return 'Password must be at least 6 characters';
  }
  return undefined;
}

export function validateUsername(username: string): string | undefined {
  const trimmed = username.trim();
  if (!trimmed) {
    return 'Username is required';
  }
  if (trimmed.length < 3) {
    return 'Username must be at least 3 characters';
  }
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return 'Username can only contain letters, numbers, and underscores';
  }
  return undefined;
}

export function validateName(name: string, fieldLabel: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) {
    return `${fieldLabel} is required`;
  }
  if (trimmed.length < 2) {
    return `${fieldLabel} must be at least 2 characters`;
  }
  return undefined;
}

export function validateLoginIdentifier(identifier: string): string | undefined {
  const trimmed = identifier.trim();
  if (!trimmed) {
    return 'Email, mobile number, or username is required';
  }
  if (trimmed.includes('@')) {
    return validateEmail(trimmed);
  }
  if (/^\d+$/.test(trimmed)) {
    return validatePhone(trimmed);
  }
  return validateUsername(trimmed);
}
