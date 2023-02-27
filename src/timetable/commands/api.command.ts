const BASE_URL = "http://bs.tplsa.ch/RTPI/rtpi?data=";

type UrlData = {
  source: string;
  destination: number;
  type: string;
  data?: Record<string, number[]>;
};

export abstract class ApiCommand {
  private readonly type: string;

  constructor(
    protected readonly name: string,
    protected readonly data: Record<string, number[]> = {}
  ) {
    this.type = name.replaceAll("_", "").toUpperCase();
  }

  protected getData() {
    return Object.keys(this.data).length > 0
      ? `data:${JSON.stringify(this.data)}`
      : "";
  }

  protected getSource(token: string) {
    return `source:"${token}"`;
  }

  protected getDestination() {
    return "destination:0";
  }

  protected getType() {
    return `type:${this.type}`;
  }

  protected buildUrl(token: string) {
    let urlObject: string = `${this.getSource(
      token
    )},${this.getDestination()},${this.getType()}`;

    if (this.getData().length > 0) {
      urlObject += `,${this.getData()}`;
    }

    return `{${urlObject}}`;
  }

  public getName() {
    return this.name;
  }

  public useCache() {
    return false;
  }

  public getRequestUrl(token = ""): string {
    return `${BASE_URL}${encodeURIComponent(this.buildUrl(token))}`;
  }
}
