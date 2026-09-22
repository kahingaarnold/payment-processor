import { SelcomGateway } from './SelcomGateway.js';
import { AzamPayGateway } from './AzamPayGateway.js';

export class PaymentProcessorManager {
  constructor() {
    this.drivers = {
      selcom: new SelcomGateway(),
      azampay: new AzamPayGateway(),
    };
  }

  async getGateway(dbClient, driverName = null) {
    const activeDriver =
      driverName || (await dbClient.getConfig('active_gateway', 'selcom'));

    const normalized = String(activeDriver).toLowerCase();
    if (!this.drivers[normalized]) {
      throw new Error(`Unsupported payment gateway driver: ${driverName}`);
    }

    return this.drivers[normalized];
  }

  getAvailableDrivers() {
    return Object.keys(this.drivers);
  }
}
