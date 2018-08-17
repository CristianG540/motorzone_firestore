export class CarItem {
  constructor (
    public _id: string,
    public cantidad: number,
    public descuento: string,
    public totalPrice?: number,
    public titulo?: string,
    public _rev?: string
  ) {}
}
