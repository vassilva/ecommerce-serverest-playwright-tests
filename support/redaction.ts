/**
 * ServeRest returns user passwords in plain text. Tests compare users without the
 * password and check it with a boolean, so a failed assertion never prints the
 * generated fake password.
 */
export function withoutPassword<T extends { password: string }>(value: T): Omit<T, 'password'> {
  const { password: _password, ...rest } = value;
  return rest;
}
