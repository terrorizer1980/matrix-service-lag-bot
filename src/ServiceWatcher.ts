import { MatrixService } from "./matrix/MatrixService";
import { IService } from "./IService";
import config from "./config";
import { timeout, TimeoutError } from 'promise-timeout';
import { LogService } from "matrix-bot-sdk";
import { v4 as uuidv4 } from "uuid";
import { errorsMetric, latencyMetric, timeoutsMetric } from "./metrics";

export class ServiceWatcher {
    constructor(private matrix: MatrixService, private monitoredService: IService, private roomId: string, private targetRef: any) {
        setInterval(this.checkLag.bind(this), config.monitoring.interval);
    }

    private async checkLag() {
        // Matrix -> Remote
        LogService.info("ServiceWatcher", `Testing ${this.matrix.name}->${this.monitoredService.name}`);
        try {
            const val = uuidv4();
            await this.matrix.sendMessage(this.roomId, val);
            const now = new Date().getTime();
            await timeout(this.monitoredService.waitForMessage(this.targetRef, val), config.monitoring.timeout);
            const tts = (new Date().getTime()) - now;
            latencyMetric.labels(this.matrix.name, this.monitoredService.name).observe(tts / 1000.0);
            LogService.info("ServiceWatcher", `${this.matrix.name}->${this.monitoredService.name}: ${tts}ms`);
        } catch (e) {
            if (e instanceof TimeoutError) {
                LogService.warn("ServiceWatcher", `Timeout: ${this.matrix.name}->${this.monitoredService.name}`);
                timeoutsMetric.labels(this.matrix.name, this.monitoredService.name).inc();
            } else {
                LogService.error("ServiceWatcher", `Failure: ${this.matrix.name}->${this.monitoredService.name}`, e);
                errorsMetric.labels(this.matrix.name, this.monitoredService.name).inc();
            }
        }

        // Remote -> Matrix
        LogService.info("ServiceWatcher", `Testing ${this.monitoredService.name}->${this.matrix.name}`);
        try {
            const val = uuidv4();
            await this.monitoredService.sendMessage(this.targetRef, val);
            const now = new Date().getTime();
            await timeout(this.matrix.waitForMessage(this.targetRef, val), config.monitoring.timeout);
            const tts = (new Date().getTime()) - now;
            latencyMetric.labels(this.monitoredService.name, this.matrix.name).observe(tts / 1000.0);
            LogService.info("ServiceWatcher", `${this.monitoredService.name}->${this.matrix.name}: ${tts}ms`);
        } catch (e) {
            if (e instanceof TimeoutError) {
                LogService.warn("ServiceWatcher", `Timeout: ${this.monitoredService.name}->${this.matrix.name}`);
                timeoutsMetric.labels(this.monitoredService.name, this.matrix.name).inc();
            } else {
                LogService.error("ServiceWatcher", `Failure: ${this.monitoredService.name}->${this.matrix.name}`, e);
                errorsMetric.labels(this.monitoredService.name, this.matrix.name).inc();
            }
        }
    }
}
