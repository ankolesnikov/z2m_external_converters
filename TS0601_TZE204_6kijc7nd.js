const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const reporting = require('zigbee-herdsman-converters/lib/reporting');
const modernExtend = require('zigbee-herdsman-converters/lib/modernExtend');
const e = exposes.presets;
const ea = exposes.access;
const tuya = require('zigbee-herdsman-converters/lib/tuya');

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
    model: 'Tervix ProLine Zigbee',
    vendor: 'Tervix',
    description: 'Thermostat for underfloor heating',
    fromZigbee: [tuya.fz.datapoints, fz.ignore_tuya_set_time],
    toZigbee: [tuya.tz.datapoints],
    onEvent: tuya.onEventSetTime, // Add this if you are getting no converter for 'commandMcuSyncTime'
    configure: tuya.configureMagicPacket,
    exposes: [
        e
            .binary('factory_reset', ea.STATE_SET, 'ON', 'OFF').withDescription('Full factory reset, use with caution!'),
        e
            .child_lock(),
        e
            .climate()
            .withPreset(['auto', 'manual'])
            .withSystemMode(['off', 'auto'], ea.STATE_SET, 'Whether the thermostat is turned on or off.')
            .withSetpoint('current_heating_setpoint', 5, 35, 0.5, ea.STATE_SET)
            .withRunningState(['idle', 'heat'], ea.STATE)
            .withLocalTemperature(ea.STATE)
            .withLocalTemperatureCalibration(-9, 9, 1, ea.STATE_SET),
        e
            .binary('frost_protection', ea.STATE_SET, 'ON', 'OFF')
            .withDescription('Frost protection'),
        e
            .numeric('humidity', ea.STATE)
            .withUnit('%'),
        e
            .binary('humidity_control', ea.STATE_SET, 'ON', 'OFF'),        
        e
            .numeric('humidity_limit', ea.STATE_SET)
            .withUnit('%')
            .withValueMax(90)
            .withValueStep(20)
            .withDescription('Humidity sensor limit (default: 70%)')
            .withPreset('default', 70, 'Default value'),
        e
            .enum('sensor_selection', ea.STATE_SET, ['room_temperature', 'floor_temperature', 'room_with_floor_limit'])
            .withDescription('What type of sensor are you using to meausure the temperature of the floor?'),
        e
            .numeric('floor_high_temp')
            .withUnit('°C')
            .withDescription('Maximum floor temperature (protection; default: 50 ºC)')
            .withValueMin(5)
            .withValueMax(60)
            .withValueStep(0.5)
            .withPreset('default', 25, 'Safe value'),
        e
            .numeric('floor_low_temp')
            .withValueMin(10)
            .withValueMax(30)
            .withValueStep(0.5)            
            .withUnit('°C')
            .withDescription(
                'Minimum temperature limit for frost protection. Turns the thermostat on regardless of setpoint if the temperature drops below this. (default: 15)',
            )
            .withPreset('default', 15, 'Default value'),
        e
            .numeric('max_temperature_limit')
            .withDescription('Max temperature limit. (default: 45)')
            .withUnit('°C')
            .withValueMin(35)
            .withValueMax(99)
            .withValueStep(0.5)
            .withPreset('default', 45, 'Default value'),            
        e
            .window_detection()
            .withDescription('When active the heating will cut off if an Open Window is detected'),
        e
            .binary('window_open', ea.STATE, true, false).withDescription('Window open?'),
        e
            .numeric('open_window_sensing_time', ea.STATE_SET)
            .withDescription('The duration that the drop in temperature needs to occur over (default: 14 mins)')
            .withUnit('minutes')
            .withValueMin(2)
            .withValueMax(30)
            .withValueStep(1)
            .withPreset('default', 14, 'Default value'),
        e
            .numeric('open_window_drop_limit', ea.STATE_SET)
            .withDescription('The drop in ambient room temperature that will trigger an open window warning (default: 2 C)')
            .withUnit('°C')
            .withValueMin(2)
            .withValueMax(4)
            .withValueStep(1)
            .withPreset('default', 2, 'Default value'),
        e
            .numeric('open_window_delay_time', ea.STATE_SET)
            .withDescription('The length of time the drop in temperature must be consistent for to turn the heating off (default: 30 mins)')
            .withUnit('minutes')
            .withValueMin(10)
            .withValueMax(60)
            .withValueStep(5)
            .withPreset('default', 30, 'Default value'),
        e
            .enum('run_mode', ea.STATE_SET, ['HEAT', 'COOL']),
        e
            .numeric('deadzone_temperature', ea.STATE_SET)
            .withUnit('°C')
            .withValueMax(5)
            .withValueMin(0.5)
            .withValueStep(0.5)
            .withPreset('default', 1, 'Default value')
            .withDescription('The delta between local_temperature and current_heating_setpoint to trigger Heat'),
        ],

    meta: {
        // All datapoints go in here
        tuyaDatapoints: [
            [1, 'system_mode', tuya.valueConverterBasic.lookup({off: false, auto: true})], //  "1": "Switch"
            [
                2,
                'preset',
                tuya.valueConverterBasic.lookup({auto: tuya.enum(1), manual: tuya.enum(0)}),
            ],
            [3, 'running_state', tuya.valueConverterBasic.lookup({'cool': tuya.enum(2), 'heat': tuya.enum(1), 'idle': tuya.enum(0)})], // "3": "Working status"
            [8, 'window_detection', tuya.valueConverter.onOff],                 // true "8": "Window check"
            [10, 'frost_protection', tuya.valueConverter.onOff],                // true "10": "Frost protection"
            [16, 'current_heating_setpoint', tuya.valueConverter.divideBy10],   //"16": "Set temperature"
            [19, 'max_temperature_limit', tuya.valueConverter.divideBy10 ],            // 350 "19": "Set temperature ceiling" 4FLO
            [24, 'local_temperature', tuya.valueConverter.divideBy10],          //  "24": "Current temperature"
            [25, 'window_open', tuya.valueConverter.raw],                       //  "25": "State of the window"
            [27, 'local_temperature_calibration',tuya.valueConverter.raw],      //  "27": "Temperature correction"
            [34, 'humidity', tuya.valueConverter.raw],                          // "34": "Humidity display"
            [39, 'factory_reset', tuya.valueConverter.onOff],                     //. "39": "Factory data reset"
            [40, 'child_lock', tuya.valueConverter.lockUnlock],            // false "40": "Child lock"
            [
                43,
                'sensor_selection',
                tuya.valueConverterBasic.lookup({
                    room_temperature: tuya.enum(0),
                    floor_temperature: tuya.enum(1),
                    room_with_floor_limit: tuya.enum(2),
                }),
            ],
            [48, null, tuya.valueConverter.ZWT198_schedule],                    //  "48": "Weekly program (5+1+1)"
            [48, 'schedule_weekday', tuya.valueConverter.ZWT198_schedule],
            [48, 'schedule_holiday', tuya.valueConverter.ZWT198_schedule],
            [58, 'run_mode', tuya.valueConverterBasic.lookup({'HEAT': tuya.enum(0), 'COOL': tuya.enum(1)})],                          // 0 - heat, 1- cool "58": "Run mode"
            [61, 'week_program_period', tuya.valueConverter.raw],               //  "61": "week program periods"
            [101, 'deadzone_temperature', tuya.valueConverter.divideBy10],               // 5 "101": "switchsensitivity"
            [102, 'floor_high_temp', tuya.valueConverter.divideBy10],     // 300 "102": "Floor hight temp.  protect. (max)"
            [103, 'floor_low_temp', tuya.valueConverter.divideBy10],     // 150 "103": "Floor low. temp. (min)" 3ДР
            [104, 'open_window_sensing_time', tuya.valueConverter.raw],         // 15 "104": "owd_time" 9Orl час визначення OWD (відкрите вікно)
            [105, 'open_window_drop_limit', tuya.valueConverter.raw],           // 2 "105": "owd_temp" 00rp пониженння задданої температури при OWD
            [106, 'open_window_delay_time', tuya.valueConverter.raw],             //30 "106": "owd_delaytime"
            [107, 'humidity_control', tuya.valueConverter.onOff],               // true "107": "Humidity control" bHEN
            [108, 'humidity_limit', tuya.valueConverter.raw],                   // 80 "108": "Upper humidity limit" CHST
        ],
    },
    extend: [
        // A preferred new way of extending functionality.
    ],
};

module.exports = definition;
