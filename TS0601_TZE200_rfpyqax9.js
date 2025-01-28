const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const reporting = require('zigbee-herdsman-converters/lib/reporting');
const modernExtend = require('zigbee-herdsman-converters/lib/modernExtend');
const e = exposes.presets;
const ea = exposes.access;
const tuya = require('zigbee-herdsman-converters/lib/tuya');

const definition = {
    // Since a lot of TuYa devices use the same modelID, but use different datapoints
    // it's necessary to provide a fingerprint instead of a zigbeeModel
    fingerprint: [
        {
            // The model ID from: Device with modelID 'TS0601' is not supported
            // You may need to add \u0000 at the end of the name in some cases
            modelID: 'TS0601',
            // The manufacturer name from: Device with modelID 'TS0601' is not supported.
            manufacturerName: '_TZE200_rfpyqax9',
        },
    ],
    model: 'Pro Line X10 ZigBee (8 zone)',
    vendor: 'Tervix',
    description: '8 zone underfloor heating controller',
    fromZigbee: [tuya.fz.datapoints],
    toZigbee: [tuya.tz.datapoints],
    onEvent: tuya.onEventSetTime, // Add this if you are getting no converter for 'commandMcuSyncTime'
    configure: tuya.configureMagicPacket,
    exposes: [
            tuya.exposes.switch().withEndpoint('zone01').withDescription('Zone 1 state'),
            tuya.exposes.switch().withEndpoint('zone02').withDescription('Zone 2 state'),
            tuya.exposes.switch().withEndpoint('zone03').withDescription('Zone 3 state'),
            tuya.exposes.switch().withEndpoint('zone04').withDescription('Zone 4 state'),
            tuya.exposes.switch().withEndpoint('zone05').withDescription('Zone 5 state'),
            tuya.exposes.switch().withEndpoint('zone06').withDescription('Zone 6 state'),
            tuya.exposes.switch().withEndpoint('zone07').withDescription('Zone 7 state'),
            tuya.exposes.switch().withEndpoint('zone08').withDescription('Zone 8 state'),
            e.binary('pump', ea.STATE_SET, 'ON', 'OFF').withDescription('Pump state'),
            e.binary('boiler', ea.STATE_SET, 'ON', 'OFF').withDescription('Boiler state'),
            e.binary('mode', ea.STATE_SET, 'ON', 'OFF').withDescription('Heat Mode'),
        ],
    endpoint: (device) => {
            return {'zone01': 1, 'zone02': 1, 'zone03': 1, 'zone04': 1, 'zone05': 1, 'zone06': 1, 'zone07': 1, 'zone08': 1,'pump': 1,'boiler': 1, 'mode': 1};
        },
    meta: {
            multiEndpoint: true,
            tuyaDatapoints: [
                [101, 'state_zone01', tuya.valueConverter.onOff],
                [102, 'state_zone02', tuya.valueConverter.onOff],
                [103, 'state_zone03', tuya.valueConverter.onOff],
                [104, 'state_zone04', tuya.valueConverter.onOff],
                [105, 'state_zone05', tuya.valueConverter.onOff],
                [106, 'state_zone06', tuya.valueConverter.onOff],
                [107, 'state_zone07', tuya.valueConverter.onOff],
                [108, 'state_zone08', tuya.valueConverter.onOff],
                [109, 'pump', tuya.valueConverterBasic.lookup({OFF: tuya.enum(0), ON: tuya.enum(1)})],
                [110, 'boiler', tuya.valueConverterBasic.lookup({OFF: tuya.enum(0), ON: tuya.enum(1)})],
                [111, 'mode', tuya.valueConverterBasic.lookup({OFF: tuya.enum(0), ON: tuya.enum(1)})],
            ],
    },
    // whiteLabel: [
    //     tuya.whitelabel('ZYXH', 'TS0601_switch_10', '10 Gang switch', ['_TZE200_rfpyqax9']),
    // ],
};

module.exports = definition;
