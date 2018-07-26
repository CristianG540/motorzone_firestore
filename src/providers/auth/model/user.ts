export class User {
  constructor (
    public uid: string,
    public name: string,
    public username: string,
    public idAsesor: number, // Cada cliente tiene el id de su asesor asignado / y pues si es un asesor su propio id
    public email: number,
    public nitCliente?: number, // si el usuario tiene este nit es un cliente, sino es un asesor
    public verificationEmailIsSend?: boolean,
    public bodega?: string
  ) {}
}
