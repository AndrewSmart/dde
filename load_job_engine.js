//symbols loaded from job_engine code needed by the test suite

var {sind, cosd, tand, asind, acosd, atand, atan2d} = require("./math/Trig_in_Degrees.js")
var Convert = require("./math/Convert.js")
var Coor = require("./math/Coor.js")
var Kin = require("./math/Kin.js")
var Vector = require("./math/Vector.js")

var {dde_error, warning, shouldnt, array_to_csv, csv_to_array, Duration, flatten, fn_is_keyword_fn, format_number, make_ins_arrays, same_elts,
    patch_until, version_equal, version_less_than, version_more_than, dde_version_between} = require("./core/utils.js")

var {choose_file, choose_save_file, choose_file_and_get_content, load_files, persistent_get, persistent_remove, persistent_save} = require("./core/storage.js")

var {serial_devices, serial_path_to_info_map,
     serial_connect_low_level, serial_send_low_level,
    serial_disconnect, serial_flush} = require("./core/serial.js")

var {deg_c_to_c, deg_c_to_f, deg_f_to_c,
     deg_c_to_k, deg_k_to_c,
     deg_k_to_f, deg_f_to_k, } = require("./core/units.js")

var {out} = require("./core/out.js")

var {DXF} = require("./math/DXF.js")

var {Instruction, make_ins, human_task_handler, human_enter_choice_handler,
    human_enter_filepath_handler, human_enter_number_handler, human_enter_position_handler,
    human_enter_instruction_handler,
    human_enter_text_handler, human_show_window_handler} = require("./core/instruction.js")

var {Robot, Brain, Dexter, Human, Serial} = require('./core/robot.js')
var Job = require('./core/job.js')



