const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const reporting = require('zigbee-herdsman-converters/lib/reporting');
const modernExtend = require('zigbee-herdsman-converters/lib/modernExtend');
const e = exposes.presets;
const ea = exposes.access;
const tuya = require('zigbee-herdsman-converters/lib/tuya');
const utils = require('zigbee-herdsman-converters/lib/utils');

const localConverter = {
    trvx_schedule: {
        from: (value, meta, options) => {
            const programmingMode = [];
            for (let i = 0; i < 12; i++) {
                const start = i * 4;
                const time = value[start].toString().padStart(2, '0') + ':' + value[start + 1].toString().padStart(2, '0');
                const temp = (value[start + 2] * 256 + value[start + 3]) / 10;
                const tempStr = temp.toFixed(1) + '°C';
                programmingMode.push(time + '/' + tempStr);
            }
            return {
                schedule_weekday: programmingMode.slice(0, 4).join(' '),
                schedule_saturday: programmingMode.slice(4, 8).join(' '),
                schedule_sunday: programmingMode.slice(8, 12).join(' '),
            };
        },
        to: async (v, meta) => {
            const dpId = 109;
            const payload = [];
            let weekdayFormat;
            let saturdayFormat;
            let sundayFormat;
            if (meta.message.schedule_monfri !== undefined) {
                weekdayFormat = v;
                saturdayFormat = meta.state['schedule_saturday'];
                sundayFormat = meta.state['schedule_sunday'];
            }
            else {
                weekdayFormat = meta.state['schedule_weekday'];
                saturdayFormat = v;
                sundayFormat = v;
            }
            function scheduleToRaw(key, input, number, payload, meta) {
                const items = input.trim().split(/\s+/);
                if (items.length != number) {
                    throw new Error('Wrong number of items for ' + key + ' :' + items.length);
                }
                else {
                    for (let i = 0; i < number; i++) {
                        const timeTemperature = items[i].split('/');
                        if (timeTemperature.length != 2) {
                            throw new Error('Invalid schedule: wrong transition format: ' + items[i]);
                        }
                        const hourMinute = timeTemperature[0].split(':', 2);
                        const hour = parseInt(hourMinute[0]);
                        const minute = parseInt(hourMinute[1]);
                        const temperature = parseFloat(timeTemperature[1]);
                        if (!utils.isNumber(hour) ||
                            !utils.isNumber(temperature) ||
                            !utils.isNumber(minute) ||
                            hour < 0 ||
                            hour >= 24 ||
                            minute < 0 ||
                            minute >= 60 ||
                            temperature < 5 ||
                            temperature >= 35) {
                            throw new Error('Invalid hour, minute or temperature (5<t<35) in ' +
                                key +
                                ' of: `' +
                                items[i] +
                                '`; Format is `hh:m/cc.c` or `hh:mm/cc.c°C`');
                        }
                        const temperature10 = Math.round(temperature * 10);
                        payload.push(hour, minute, (temperature10 >> 8) & 0xff, temperature10 & 0xff);
                    }
                }
                return;
            }
            scheduleToRaw('schedule_weekday', weekdayFormat, 4, payload, meta);
            scheduleToRaw('schedule_saturday', saturdayFormat, 4, payload, meta);
            scheduleToRaw('schedule_sunday', sundayFormat, 4, payload, meta);
            const entity = meta.device.endpoints[0];
            const sendCommand = utils.getMetaValue(entity, meta.mapped, 'tuyaSendCommand', undefined, 'dataRequest');
            await tuya.sendDataPointRaw(entity, dpId, payload, sendCommand, 1);
        },
    },
};

const definition = {
    // Since a lot of Tuya devices use the same modelID, but use different datapoints
    // it's necessary to provide a fingerprint instead of a zigbeeModel
    fingerprint: [
        {
            // The model ID from: Device with modelID 'TS0601' is not supported
            // You may need to add \u0000 at the end of the name in some cases
            modelID: 'TS0601',
            // The manufacturer name from: Device with modelID 'TS0601' is not supported.
            manufacturerName: '_TZE204_6kijc7nd',
        },
    ],
    model: 'Pro Line ZigBee Thermostat',
    vendor: 'Tervix',
    description: 'Wall Thermostat',
    // fromZigbee: [tuya.fz.datapoints, fz.ignore_tuya_set_time],
    fromZigbee: [tuya.fz.datapoints],
    toZigbee: [tuya.tz.datapoints],
    onEvent: tuya.onEventSetTime, // Add this if you are getting no converter for 'commandMcuSyncTime'
    configure: tuya.configureMagicPacket,
    exposes: [
        e
            .binary('factory_reset', ea.STATE_SET, 'ON', 'OFF').withDescription('Full factory reset, use with caution!').withCategory('config'),
        e
            .child_lock(),
        e
            .climate()
            .withPreset(['program', 'manual'])
            .withSystemMode(['off', 'auto'], ea.STATE_SET, 'Whether the thermostat is turned on or off.')
            .withSetpoint('current_heating_setpoint', 5, 35, 0.5, ea.STATE_SET)
            .withRunningState(['idle', 'heat', 'cool'], ea.STATE)
            .withRunningMode(['heat', 'cool'], ea.STATE_SET)
            .withLocalTemperature(ea.STATE)
            .withLocalTemperatureCalibration(-9, 9, 1, ea.STATE_SET),
        ...tuya.exposes.scheduleAllDays(ea.STATE_SET, 'HH:MM/C HH:MM/C HH:MM/C HH:MM/C'),
        e
            .binary('frost_protection', ea.STATE_SET, 'ON', 'OFF')
            .withDescription('Frost protection')
            .withCategory('config'),
        e
            .numeric('humidity', ea.STATE)
            .withUnit('%'),
        e
            .binary('humidity_control', ea.STATE_SET, 'ON', 'OFF').withCategory('config'),        
        e
            .numeric('humidity_limit', ea.STATE_SET)
            .withUnit('%')
            .withValueMax(90)
            .withValueStep(20)
            .withDescription('Humidity sensor limit (default: 70%)')
            .withPreset('default', 70, 'Default value')
            .withCategory('config'),
        e
            .enum('sensor_selection', ea.STATE_SET, ['room_temperature', 'floor_temperature', 'room_with_floor_limit'])
            .withDescription('What type of sensor are you using to meausure the temperature of the floor?')
            .withCategory('config'),
        e
            .numeric('floor_high_temp', ea.STATE_SET)
            .withUnit('°C')
            .withDescription('Maximum floor temperature (protection; default: 50 ºC)')
            .withValueMin(5)
            .withValueMax(60)
            .withValueStep(0.5)
            .withPreset('default', 25, 'Safe value')
            .withCategory('config'),
        e
            .numeric('floor_low_temp', ea.STATE_SET)
            .withValueMin(10)
            .withValueMax(30)
            .withValueStep(0.5)            
            .withUnit('°C')
            .withDescription(
                'Minimum temperature limit for frost protection. Turns the thermostat on regardless of setpoint if the temperature drops below this. (default: 15)',
            )
            .withPreset('default', 15, 'Default value')
            .withCategory('config'),
        e
            .numeric('max_temperature', ea.STATE_SET)
            .withDescription('Max temperature limit. (default: 45)')
            .withUnit('°C')
            .withValueMin(35)
            .withValueMax(99)
            .withValueStep(0.5)
            .withPreset('default', 45, 'Default value')
            .withCategory('config'),
        e
            .window_detection()
            .withDescription('When active the heating will cut off if an Open Window is detected'),
        // e
        //     .numeric('window_open', ea.STATE).withDescription('Open window detected'),
        e
            .binary('window_open', ea.STATE, 'close', 'open').withDescription('Window status CLOSE or OPEN '),
        e
            .numeric('open_window_sensing_time', ea.STATE_SET)
            .withDescription('The duration that the drop in temperature needs to occur over (default: 14 mins)')
            .withUnit('minutes')
            .withValueMin(2)
            .withValueMax(30)
            .withValueStep(1)
            .withPreset('default', 15, 'Default value')
            .withCategory('config'),
        e
            .numeric('open_window_drop_limit', ea.STATE_SET)
            .withDescription('The drop in ambient room temperature that will trigger an open window warning (default: 2 C)')
            .withUnit('°C')
            .withValueMin(2)
            .withValueMax(4)
            .withValueStep(1)
            .withPreset('default', 2, 'Default value')
            .withCategory('config'),
        e
            .numeric('open_window_delay_time', ea.STATE_SET)
            .withDescription('The length of time the drop in temperature must be consistent for to turn the heating off (default: 30 mins)')
            .withUnit('minutes')
            .withValueMin(10)
            .withValueMax(60)
            .withValueStep(5)
            .withPreset('default', 30, 'Default value')
            .withCategory('config'),
        e
            .numeric('deadzone_temperature', ea.STATE_SET)
            .withUnit('°C')
            .withValueMax(5)
            .withValueMin(0.5)
            .withValueStep(0.5)
            .withPreset('default', 1, 'Default value')
            .withDescription('The delta between local_temperature and current_heating_setpoint to trigger Heat')
            .withCategory('config'),
        // e
        //     .text('weekly_program', ea.STATE_SET)
        //     .withDescription('5+1+1 Schedule, 4 entries per day max, example: "TBD °C"'),
        e.text('schedule_weekday', ea.STATE_SET).withDescription('Workdays (4 times `hh:mm/cc.c°C`)'),
        e.text('schedule_saturday', ea.STATE_SET).withDescription('Holidays (4 times `hh:mm/cc.c°C)`'),
        e.text('schedule_sunday', ea.STATE_SET).withDescription('Holidays (4 times `hh:mm/cc.c°C)`'),

        ],

    meta: {
        // All datapoints go in here
        tuyaDatapoints: [
            [1, 'system_mode', tuya.valueConverterBasic.lookup({off: false, auto: true})], //  "1": "Switch"
            [
                2,
                'preset',
                tuya.valueConverterBasic.lookup({program: tuya.enum(1), manual: tuya.enum(0)}),
            ],
            [3, 'running_state', tuya.valueConverterBasic.lookup({cool: tuya.enum(2), heat: tuya.enum(1), idle: tuya.enum(0)})], // "3": "Working status"
            [8, 'window_detection', tuya.valueConverter.onOff],                 // "8": "Window check"
            [10, 'frost_protection', tuya.valueConverter.onOff],                // "10": "Frost protection"
            [16, 'current_heating_setpoint', tuya.valueConverter.divideBy10],   // "16": "Set temperature"
            [19, 'max_temperature', tuya.valueConverter.divideBy10 ],     // "19": "Set temperature ceiling" 4FLO
            [24, 'local_temperature', tuya.valueConverter.divideBy10],          // "24": "Current temperature"
            [25, 'window_open', tuya.valueConverterBasic.onOff],                // "25": "State of the window"
            [27, 'local_temperature_calibration',tuya.valueConverter.raw],      // "27": "Temperature correction"
            [34, 'humidity', tuya.valueConverter.raw],                          // "34": "Humidity display"
            [39, 'factory_reset', tuya.valueConverter.onOff],                   // "39": "Factory data reset"
            [40, 'child_lock', tuya.valueConverter.lockUnlock],                 // "40": "Child lock"
            [
                43,
                'sensor_selection',
                tuya.valueConverterBasic.lookup({
                    room_temperature: tuya.enum(0),
                    floor_temperature: tuya.enum(1),
                    room_with_floor_limit: tuya.enum(2),
                }),
            ],
            [48, null, localConverter.trvx_schedule],
            [48, 'schedule_weekday', localConverter.trvx_schedule],
            [48, 'schedule_saturday', localConverter.trvx_schedule],
            [48, 'schedule_sunday', localConverter.trvx_schedule],
            [58, 'running_mode', tuya.valueConverterBasic.lookup({'heat': tuya.enum(0), 'cool': tuya.enum(1)})],                          // 0 - heat, 1- cool "58": "Run mode"
            [61, 'week_program_period', tuya.valueConverter.raw],               // "61": "week program periods"
            [101, 'deadzone_temperature', tuya.valueConverter.divideBy10],      // "101": "switchsensitivity"
            [102, 'floor_high_temp', tuya.valueConverter.divideBy10],           // "102": "Floor hight temp.  protect. (max)"
            [103, 'floor_low_temp', tuya.valueConverter.divideBy10],            // "103": "Floor low. temp. (min)" 3ДР
            [104, 'open_window_sensing_time', tuya.valueConverter.raw],         // "104": "owd_time" 9Orl час визначення OWD (відкрите вікно)
            [105, 'open_window_drop_limit', tuya.valueConverter.raw],           // "105": "owd_temp" 00rp пониженння задданої температури при OWD
            [106, 'open_window_delay_time', tuya.valueConverter.raw],           // "106": "owd_delaytime"
            [107, 'humidity_control', tuya.valueConverter.onOff],               // "107": "Humidity control" bHEN
            [108, 'humidity_limit', tuya.valueConverter.raw],                   // "108": "Upper humidity limit" CHST
        ],
    },
    extend: [
        // A preferred new way of extending functionality.
    ],
};

module.exports = definition;
