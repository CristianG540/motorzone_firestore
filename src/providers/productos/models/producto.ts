export class Producto {
  constructor (
    public _id: string,
    public titulo: string,
    public aplicacion: string | null,
    public imagen: string,
    public categoria: string,
    public marcas: string,
    public unidad: string,
    public existencias: number,
    public precio: number,
    public origen?: string,
    // tslint:disable-next-line:variable-name
    public updated_at?: number,
    // tslint:disable-next-line:variable-name
    public existencias_total?: string // aqui estan las cantidades del productos en ambas bd ej: 8/10
  ) { }
}
