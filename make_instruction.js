
var MakeInstruction = class MakeInstruction{
   //utilities
    static dialog_contains_move_all_joints_with_joints(){
        let instruction_name = mi_instruction_name_id.value
        if(this.in_move_all_joints_family(instruction_name)){
            let id = this.arg_name_to_dom_elt_id("joint1")
            let elt = window[id]
            if(elt) { return true }
            else    { return false }
        }
        else { return false }
    }
    static dialog_contains_move_to_with_separate_xyzs(){
        let instruction_name = mi_instruction_name_id.value
        if(this.in_move_to_family(instruction_name)){
            let id = this.arg_name_to_dom_elt_id("x")
            let elt = window[id]
            if(elt) { return true }
            else    { return false }
        }
        else { return false }
    }

    static call_obj_arg_obj_with_name(call_obj, arg_name){
        for(let arg_obj of call_obj.args){
            if(arg_obj.name == arg_name) { return arg_obj }
        }
        dde_error("call_obj_arg_obj_with_name couldn't find: " + arg_name + " in: " + call_obj)
    }
    //var the_move_all_joints_family = ["Dexter.move_all_joints", "Dexter.move_all_joints_relative", "Dexter.pid_move_all_joints"]
    //beware, we might have an instruction name like "dex3.move_all_joints" which
    //doesn't have a "Dexter" prefix
    static in_move_all_joints_family(instruction_name){
        return ends_with_one_of(instruction_name, [".move_all_joints", ".move_all_joints_relative", ".pid_move_all_joints"])
    }

    static in_move_to_family(instruction_name){
        return ends_with_one_of(instruction_name, [".move_to", ".move_to_relative", ".move_to_straight", ".pid_move_to"])
    }

    //you can pass "instruction_name" even though its not really an "arg"
    static arg_name_to_dom_elt_id(arg_name){
        if(arg_name == "instruction_name") { return "mi_instruction_name_id" }
        else if(arg_name.startsWith("...")){ arg_name = arg_name.substring(3) }
        return "mi_arg_" + arg_name + "_id"
    }

    //the default color is transparent
    static set_border_color_of_arg(arg_name, color="rgb(238, 238, 238)"){
        let id = this.arg_name_to_dom_elt_id(arg_name)
        let elt = window[id]
        if(elt){
          elt.style.borderColor = color
        }
    }
    //end utilities

    //stolen from js2b.js
    static string_to_ast(src){
        if (src[0] == "{") { //esprima doesn't like so hack it
            let new_src = "var foo947 = " + src
            let st = esprima.parse(new_src, {range: true, loc: true})
            let new_st = st.body[0].declarations[0].init
            return new_st
        }
        else {
            return esprima.parse(src, {range: true, loc: true})
        }
    }
    //always returns a lit obj but it might be empty
    static instruction_src_to_call_obj(src=""){
        let result = {name: "", args:[]}
        if ((src == null) || (src == "")) {return result} //nothing there so return empty obj
        let ast = null
        src = src.trim()
        try{ast = this.string_to_ast(src)}
        catch(err){
           let first_paren_index = src.indexOf("(")
           if(first_paren_index == -1) { //can't find anything in this src so punt
               return result
           }
           else {
               let full_name = src.substring(0, first_paren_index).trim()
               if (full_name.length == 0) { return result } //can't find anything in this src so punt
               else {
                   result.name = full_name
                   return result
               }
           }
        }
        let instruction_name = this.extract_name_from_ast(ast)
        if (instruction_name) { result.name = instruction_name }
        let args = this.extract_args_from_ast(ast, instruction_name, src)
        if (args) { result.args = args }
        return result
    }
    static extract_name_from_ast(ast){
        try{
            let call_ast = ast.body[0].expression
            let the_called_fn_ast = call_ast.callee
            let instruction_name
            let name
            let prop
            if(the_called_fn_ast.type == "Identifier") { instruction_name = the_called_fn_ast.name }
            else {
                let name = (the_called_fn_ast.object && the_called_fn_ast.object.name)  //ie "Dexter"
                let prop = (the_called_fn_ast.property && the_called_fn_ast.property.name)
                if(name){
                    if (prop) { instruction_name =  name + "." + prop }
                    else { instruction_name = name }
                }
                else if (prop) { instruction_name = prop }
            }
            return instruction_name
        }
        catch(err) {return null}
    }

    //makes an array of objs of each arg in ast. If there isn't an arg in the ast,
    //we get its default value from the fn_name's default value.
    //so we populate the returned val with either the actual arg_src in the ast,
    //or the default arg src from fn_name
    //if returns null, that means we couldn't parse the args so have to get the
    //default args from the instructions' def.
    static extract_args_from_ast(ast, instruction_name, src){
        if(this.in_move_all_joints_family(instruction_name)){
            return this.extract_args_from_ast_maj(ast, instruction_name, src)
        }
        else if (this.in_move_to_family(instruction_name)){
            return this.extract_args_from_ast_mt(ast, instruction_name, src)
        }
        else{
            return this.extract_args_from_ast_normal(ast, instruction_name, src)
        }
    }

    //return string of src code for arg_name in prop_array (from ast) OR returnn undefined meaning couldn't find it
    static find_arg_val_src_in_prop_array(arg_name, prop_array, src){
        for(let prop_ast of prop_array){
            if(prop_ast.key.name == arg_name){
                return src.substring(prop_ast.value.range[0], prop_ast.value.range[1])
            }
        }
    }

    static extract_args_from_ast_normal(ast, instruction_name, src){
        let fn = value_of_path(instruction_name)
        let default_arg_name_val_src_pairs = function_param_names_and_defaults_array(fn, true)
        let args_array = []
        if(starts_with_one_of(instruction_name, ["Dexter.", "Serial."]) &&
            (default_arg_name_val_src_pairs.length > 0) &&
            (last(default_arg_name_val_src_pairs)[0] == "robot")){
            default_arg_name_val_src_pairs.pop() //get rid of "robot"
        }
        //arg_name_val_src_pairs holds all the arg names and their default values.
        //only use those defaults if no value from ast/src
        try{
            let src_args_array = ast.body[0].expression.arguments
            for(let i = 0; i <  default_arg_name_val_src_pairs.length; i++){
                let default_arg_pair = default_arg_name_val_src_pairs[i]
                let arg_name = default_arg_pair[0]
                let src_arg_ast = src_args_array[i]
                let arg_val_src
                if(src_arg_ast){
                    if(src_arg_ast.type == "ObjectExpression"){
                        let prop_array = src_arg_ast.properties
                        for(let default_arg_pair of default_arg_name_val_src_pairs){
                            arg_name = default_arg_pair[0]
                            arg_val_src = this.find_arg_val_src_in_prop_array(arg_name, prop_array, src)
                            if(arg_val_src === undefined) { arg_val_src = default_arg_pair[1]}
                            if(arg_val_src === undefined) { arg_val_src = "" } //its supposed to be src, so it should be a string
                            args_array.push({name: arg_name, arg_val_src: arg_val_src})
                        }
                        break;
                    }
                    else {
                        arg_val_src = src.substring(src_arg_ast.range[0], src_arg_ast.range[1])
                        if(arg_val_src === undefined) { arg_val_src = "" } //its supposed to be src, so it should be a string
                        args_array.push({name: arg_name, arg_val_src: arg_val_src})
                    }
                }
                else {
                    arg_val_src = default_arg_pair[1]
                    if(arg_val_src === undefined) { arg_val_src = "" } //its supposed to be src, so it should be a string
                    args_array.push({name: arg_name, arg_val_src: arg_val_src})
                }
            }
        }
        catch(err) {}
        return args_array
    }

    static extract_args_from_ast_maj(ast, instruction_name, src){
        let args_array = []
        let call_ast = ast.body[0].expression
        let the_args_ast = (call_ast && call_ast.arguments)
        let arg0_ast = the_args_ast[0]
        if ((the_args_ast.length == 1) && (arg0_ast.type != "ArrayExpression")) { //1 arg dialog
              let arg_name = "array_of_angles"
              let arg_val_src = src.substring(arg0_ast.range[0], arg0_ast.range[1])
              args_array.push({name: arg_name, arg_val_src: arg_val_src})
        }
        else { //7 arg dialog. this hits if there are no args as well as > 1 arg, or if the 1 arg is a lit array
            if ((the_args_ast.length == 1) && (arg0_ast.type == "ArrayExpression")) { //got a lit array in that 1 arg
                the_args_ast = the_args_ast[0].elements
            }
            //now the_args_ast is an array of the individual args.
            let fn = value_of_path(instruction_name)
            let arg_name_val_src_pairs = function_param_names_and_defaults_array(fn)
            for(let j = 1; j < 8; j++){
                let arg_name = "joint" + j
                let arg_ast = the_args_ast[j - 1]
                let arg_val_src = ""
                if (arg_ast){
                    let range = arg_ast.range
                    if(!range) { arg_val_src = "parsing_error" }
                    else { arg_val_src = src.substring(range[0], range[1]) }
                }
                else { //no arg so use default val
                    arg_val_src = "0"
                }
                args_array.push({name: arg_name, arg_val_src: arg_val_src})
            }
            return args_array
        }
        return args_array
    }
    //for parsing move_to family calls
    static extract_args_from_ast_mt(ast, instruction_name, src){
        let args_array = []
        let call_ast = ast.body[0].expression
        let the_args_ast = (call_ast && call_ast.arguments)
        let arg0_ast = the_args_ast[0] //the xyz arg
        if (!arg0_ast) { //rare case where there's no args at all in the src
            for(let arg_name of ["x", "y", "z"]){
                let arg_val_src = "0"
                args_array.push({name: arg_name, arg_val_src: arg_val_src})
            }
        }
        else if (arg0_ast.type == "ArrayExpression") {
             let elts_ast = arg0_ast.elements
             for(let i = 0; i < 3; i++) {
                 let arg_name = ["x", "y", "z"][i]
                 let elt_ast = elts_ast[i]
                 let arg_val_src = "0"
                 if(elt_ast){ arg_val_src = src.substring(elt_ast.range[0], elt_ast.range[1]) }
                 args_array.push({name: arg_name, arg_val_src: arg_val_src})
             }
        }
        else if (arg0_ast.type == "ObjectExpression") { //happens just for move_to_straight
              let props_array = arg0_ast.properties
              for(let prop of props_array){
                  let arg_name     = prop.key.name
                  if(arg_name == "xyz"){
                      let prop_val_ast = prop.value
                      if(prop_val_ast.type == "ArrayExpression"){
                          let arg_vals_array = prop_val_ast.elements
                          for(let i = 0; i < 3; i++) {
                              let arg_name = ["x", "y", "z"][i]
                              let elt_ast = arg_vals_array[i]
                              let arg_val_src = "0"
                              if(elt_ast){ arg_val_src = src.substring(elt_ast.range[0], elt_ast.range[1]) }
                              args_array.push({name: arg_name, arg_val_src: arg_val_src})
                          }
                      }
                      else {
                          let arg_val_src  = src.substring(prop_val_ast.range[0], prop_val_ast.range[1])
                          args_array.push({name: arg_name, arg_val_src: arg_val_src})
                      }
                  }
                  else {
                      let arg_val_src  = src.substring(prop.value.range[0], prop.value.range[1])
                      args_array.push({name: arg_name, arg_val_src: arg_val_src})
                  }
              }
        }
        else { return this.extract_args_from_ast_normal(ast, instruction_name, src) }
        //now args_array is an array of the individual args & vals from the src
        let fn = value_of_path(instruction_name)
        let arg_name_val_src_pairs = function_param_names_and_defaults_array(fn, true)
        arg_name_val_src_pairs.shift() //get rid of the first "xyz" param
        arg_name_val_src_pairs.pop()  //get rid of "robot" last arg
        try{
            the_args_ast.shift() //get rid of first elt (xyz)
            for(let i = 0; i <  arg_name_val_src_pairs.length; i++){
                let arg_pair = arg_name_val_src_pairs[i]
                let arg_name = arg_pair[0]
                let the_arg_ast = the_args_ast[i]
                let arg_val_src = src.substring(the_arg_ast.range[0], the_arg_ast.range[1])
                if(arg_val_src === undefined) { arg_val_src = arg_pair[1] }
                if(arg_val_src === undefined) { arg_val_src = "" } //its supposed to be src, so it should be a string
                args_array.push({name: arg_name, arg_val_src: arg_val_src})
            }
        }
        catch(err) {}
        return args_array
    }
    //top level fn
    static show(instruction_call_src="Dexter.move_all_joints()", show_doc=true){
        misc_pane_menu_id.value = "Make Instruction"
        let call_obj = this.instruction_src_to_call_obj(instruction_call_src)
        //if(!call_obj.name) { call_obj.name = "Dexter.move_all_joints" }
        //if(!call_obj.args) { this.fill_in_call_obj_args_from_name(call_obj) }
        let instruction_name = call_obj.name
        //style='height:300px; width:300px; padding:5px; background-color:#EEEEEE; overflow:scroll;'
        //sim_graphics_pane_id.innerHTML =
        sim_pane_content_id.innerHTML =
          `<div style="background-color:#EEEEEE;">
           <div style="font-size:14px;font-weight:700;margin-left:50px;">Make Instruction</div>` +
           this.make_robots_select_html() +
           "<div style='white-space:nowrap;'>" +  //white-space:nowrap;
            this.make_instruction_menu_html() +
           ":<input id='mi_instruction_name_id' onchange='MakeInstruction.set_instruction_name_and_args()' style='width:300px;margin-left:5px;vertical-align:25%;font-size:14px;'/></div>" +
           "<div id='mi_args_id'> </div>" +
            this.replace_args_html(call_obj) +
            this.bottom_buttons_html() +
           "</div>"
        $("#mi_instruction_menu_id").jqxMenu({autoOpen: false, clickToOpen: false, height: '25px' })
        $("#mi_instruction_menu_id").jqxMenu('setItemOpenDirection', 'mi_instruction_id', 'right', 'up');

        this.set_instruction_name_and_args(call_obj, show_doc)
        $("#mi_replace_args_id").jqxMenu({autoOpen: false, clickToOpen: false, height: '25px' })
    }

    static is_shown(){
        if(window["mi_instruction_menu_id"]) { return true }
        else { return false }
    }

    static make_robots_select_html(){
        var result = "<div style='margin-top:5px;'>Robot: <select id='mi_robot_name_id' style='font-size:14px;width:130px;'>"
        for(let name of Robot.all_names){
            result += "<option>" + name + "</option>"
        }
        result += "</select></div>"
        return result
    }

    static make_instruction_menu_item_html(label_array){
      let result = "<li>" + label_array[0] + "<ul>"
      for(let i = 1; i < label_array.length; i++){
         let label = label_array[i]  //setting the width below fails. usingn title lets you see long menu items
         result += "<li style='width:300px;' title='" + label + "' onclick='MakeInstruction.instruction_menu_click(event)'>" + label + "</li>"
      }
      result += "</ul></li>"
      return result
    }
    static make_instruction_menu_html(){
       let result = `<div title='Choose the type of instruction to make.' id='mi_instruction_menu_id' class='dde_menu' style="display:inline-block;height:15px;padding:0px;margin-top:5px;">
                      <ul style="display:inline-block;padding:0;margin-top:0px;">
                        <li id="mi_instruction_id" style="display:inline-block;padding-left:3px;padding-right:0px;">Instruction&#9660;<ul>`
       for(let labels of this.menu_hierarchy){
           result += this.make_instruction_menu_item_html(labels)
       }
       result += "</ul></li></ul></div>"
       return result
    }
    static instruction_menu_item_parent(label){
       for(let submenu_array of MakeInstruction.menu_hierarchy){
           if(submenu_array.includes(label)) { return submenu_array[0] }
       }
    }
    static instruction_menu_item_prefix(label){
        let parent_label = this.instruction_menu_item_parent(label)
        if      (parent_label.startsWith("Dexter")) { return "Dexter."}
        else if (parent_label.startsWith("Human"))  { return "Human."}
        else if (parent_label.startsWith("Robot"))  { return "Robot."}
        else if (parent_label.startsWith("Serial")) { return "Serial."}
        else { return "" }
    }

    static instruction_menu_click(event){
        let label = event.target.innerText
        let prefix = this.instruction_menu_item_prefix(label)
        this.set_instruction_name_and_args(prefix + label)
    }

    // call_obj can be just a string of the fn name, or a call_obj
    //called whnn the instrucdtion name tuype in is changed.
    //beware sometimes happens automagically.
    static set_instruction_name_and_args(call_obj, show_doc=true){
        let instruction_name
        if (typeof(call_obj) == "string") {
            instruction_name = call_obj
            call_obj = {name: instruction_name}
        }
        else if (call_obj) { instruction_name = call_obj.name }
        else if (window.mi_instruction_name_id) {
            instruction_name = mi_instruction_name_id.value
            call_obj = {name: instruction_name}
        }
        else {
            instruction_name = "" //don't default here to "Dexter.move_all_joints", default to "" as that's
                                  //what we might get from option click from editor, ie nothing.
                                  //so don't pretend that we got a move_all_joints, force the user to pick
            call_obj = {name: instruction_name}
        }
        if (instruction_name == "") { call_obj.args = [] }
        else if (!call_obj.args) {
           let fn = value_of_path(instruction_name)
            if(fn === undefined) {
                this.set_border_color_of_arg("instruction_name", "red")
                out("<span style='color:red'>Error: </span>" +
                    "The instruction name: <code>" + instruction_name + "</code> can't be evaluated.<br/>" +
                    "Correct errors and try again.")
                return null
            }
            else if (typeof(fn) != "function"){
                this.set_border_color_of_arg("instruction_name", "red")
                out("<span style='color:red'>Error: </span>" +
                    "The instruction name: <code>instruction_name</code> is not a function.<br/>" +
                    "Correct errors and try again.")
                return null
            }
            else { this.set_border_color_of_arg("instruction_name")
                   this.fill_in_call_obj_args_from_name(call_obj)
                   //proceed to rest of fn
            }
        }
        mi_instruction_name_id.value = instruction_name
        this.set_instruction_args(call_obj)
        if(show_doc) {
            try{ open_doc(instruction_name + "_doc_id") }
            catch(err) {} //ignore. might be trying to get doc on Math.pow or something not in the doc so, just don't do it
        }
    }
    static set_instruction_args(call_obj){
        let arg_html = ""
        let instruction_name = call_obj.name
        if(this.in_move_all_joints_family(instruction_name) && call_obj.args[0].joint1){
            for(let j=1; j < 8; j++){
                let arg_name = "joint" + j
                let arg_obj = this.call_obj_arg_obj_with_name(call_obj, arg_name)
                let arg_val_src = arg_obj.arg_val_src
                if(arg_val_src === undefined) { arg_val_src = "0" }
                let id = this.arg_name_to_dom_elt_id(arg_name)
                arg_html += "<div style='margin:5px;white-space:nowrap;'>" + arg_name + ": <input style='width:300px;' id='" + id + "' value='" + arg_val_src + "'/></div>"
            }
        }
        else { //handles the 1 arg case of move_all_joints and most other instructions
            for(let arg_obj of call_obj.args){
                //let arg_obj = this.call_obj_arg_obj_with_name(call_obj, arg_name)
                let arg_name = arg_obj.name
                //handles xyz arg of move_to family
                if(((arg_name == "xyz") || (arg_name == "delta_xyz")) &&
                    call_obj.args[0] == "x") {
                    for(let arg_name of ["x", "y", "z"]){
                        let arg_obj = this.call_obj_arg_obj_with_name(call_obj, arg_name)
                        let arg_val_src = arg_obj.arg_val_src
                        if(arg_val_src === undefined) { arg_val_src = "0" }
                        let id = this.arg_name_to_dom_elt_id(arg_name)
                        arg_html += "<div style='margin:5px;white-space:nowrap;'>" + arg_name + ": <input style='width:300px;' id='" + id + "' value='" + arg_val_src + "'/></div>"
                    }
                }
                //handles most args
                else {
                    let arg_val_src = arg_obj.arg_val_src
                    if(arg_val_src === undefined) { arg_val_src = "" }
                    let id = this.arg_name_to_dom_elt_id(arg_name)
                    arg_html += "<div style='margin:5px;white-space:nowrap;''>" + arg_name + ": <input style='width:300px;' id='" + id + "' value='" + arg_val_src + "'/></div>"
                }
            }
        }
        mi_args_id.innerHTML = arg_html
    }

    static fill_in_call_obj_args_from_name(call_obj){
        let args_array = []
        let instruction_name = call_obj.name
        let fn = value_of_path(instruction_name)
        if(!fn) {
          dde_error("instruction_name: <code style='color:black;'>" + instruction_name + "</code> is not defined.")
        }
        let arg_name_val_src_pairs = function_param_names_and_defaults_array(fn, true) //grab_key_vals
        for(let arg_name_val_src_pair of arg_name_val_src_pairs){ //Object.keys(para_names_and_defaults_lit_obj)){
            let arg_name = arg_name_val_src_pair[0]
            let arg_val_src = arg_name_val_src_pair[1]
            if(this.in_move_all_joints_family(instruction_name) &&
               ["robot", "array_of_angles", "delta_angles"].includes(arg_name)) {} //skip putting this arg in dialog. User should use robt instance as a subject to the call
            else if(starts_with_one_of(instruction_name, ["Dexter.", "Serial."]) &&
                    ["robot"].includes(arg_name)) {} //skip
            else if(arg_name == "xyz"){
                for(let arg_name of ["x", "y", "z"]){
                    args_array.push({name: arg_name, arg_val_src: "0"})
                }
            }
            else {
                args_array.push({name: arg_name, arg_val_src: arg_val_src}) //para_names_and_defaults_lit_obj[arg_name]})
            }
        }
        if(this.in_move_all_joints_family(instruction_name)){
            for(let j=1; j < 8; j++){
                let arg_name = "joint" + j
                args_array.push({name: arg_name,
                                 arg_val_src: "0"})
            }
        }
        return call_obj.args = args_array
    }

    static replace_args_html(){
        let result = "<div id='mi_replace_args_id' class='dde_menu' style='display:inline-block;height:10px;padding:0px;margin-top:5px;'><ul style='display:inline-block;padding:0;margin-top:0px;'>" +
                     "<li>Replace Arg Values With ...&#9660;<ul><li onclick='MakeInstruction.replace_arg_vals_with_defaults()'>Defaults</li>"
        result += "</ul></li></ul></div>"
        return result
    }

    static replace_arg_vals_with_defaults(){
        let instruction_name = mi_instruction_name_id.value
        let fn = value_of_path(instruction_name)
        let arg_name_val_src_pairs = function_param_names_and_defaults_array(fn, true)
        if(this.dialog_contains_move_all_joints_with_joints()){
            for(let i = 1; i < 8; i++){
                let arg_name = "joint" + i
                let id = this.arg_name_to_dom_elt_id(arg_name)
                let elt = window[id]
                let arg_val_src = "0"
                elt.value = arg_val_src
            }
        }
        else if(this.dialog_contains_move_to_with_separate_xyzs()){
            for(let arg_name of ["x", "y", "z"]){
                let id = this.arg_name_to_dom_elt_id(arg_name)
                let elt = window[id]
                let arg_val_src = "0"
                elt.value = arg_val_src
            }
            for(let arg_name_val_pair of arg_name_val_src_pairs){
                let arg_name = arg_name_val_pair[0]
                if(arg_name != "xyz"){
                    let id = this.arg_name_to_dom_elt_id(arg_name)
                    let elt = window[id]
                    let arg_val = arg_name_val_pair[1]
                    if(!arg_val) { arg_val = "" }
                    elt.value = arg_val
                }
            }
        }
        else {
            for(let arg_name_val_pair of arg_name_val_src_pairs){
                let arg_name = arg_name_val_pair[0]
                let id = this.arg_name_to_dom_elt_id(arg_name)
                let elt = window[id]
                let arg_val = arg_name_val_pair[1]
                if(!arg_val) { arg_val = "" }
                elt.value = arg_val
            }
        }
    }

    static bottom_buttons_html(){
       return  "<div><button style='margin:3px;' onclick='MakeInstruction.eval_instruction()' " +
                     "title='Eval the instruction.&#013;This is a good (but incomplete) test&#013;of the validity of the arguments.'>Eval Instr</button>" +

                     "<button style='margin:3px;' onclick='MakeInstruction.run()' " +
                     "title='Make a job with the instruction in it&#013;and start the job.'>Run</button>" +

                    "<button style='margin:3px;' onclick='MakeInstruction.insert_job()' " +
                     "title='Into the Editor,&#013;insert the definition of a job&#013;with the instruction in it.'>Insert Job</button>" +

                    "<button style='margin:3px;' onclick='MakeInstruction.insert_instruction()' " +
                    "title='If there is a selection in the Editor,&#013;replace it,&#013;otherwise just insert the instruction.'>Insert</button>" +
           "</div>"
    }

   /* static dialog_to_instruction_src(){
        let result = ""
        let instruction_name = mi_instruction_name_id.value
        result += instruction_name + "("
        let fn = value_of_path(instruction_name)
        let arg_name_val_src_pairs = function_param_names_and_defaults_array(fn, true)
        let param_names = []
        for(let pair of arg_name_val_src_pairs) { param_names.push(pair[0]) }
        let fn_is_keyword = fn_is_keyword_fn(fn)
        if(fn_is_keyword) { result += "{" }
        let mt_separate_xyzs = this.dialog_contains_move_to_with_separate_xyzs()
        if(this.dialog_contains_move_all_joints_with_joints()){
            result += "["
            param_names = ["joint1", "joint2", "joint3","joint4","joint5","joint6","joint7"]
        }
        else if (mt_separate_xyzs){
            if(param_names[0] == "xyz") { param_names.shift() }
            else { shouldnt("no first 'xyz' param in dialog_to_instruction_src with instruction: " + instruction_name +
                             " and param_names: " + param_names) }
            param_names.unshift("z")
            param_names.unshift("y")
            param_names.unshift("x")

        }
        if(starts_with_one_of(instruction_name, ["Dexter.", "Serial."]) && (last(param_names) == "robot")) {
            param_names.pop() //user should be using robot instance as subject, not as last arg
            //else { shouldnt("no last 'robot' param_name in dialog_to_instruction_src with instruction: " + instruction_name +
            //                " and param_names: " + param_names)  }
        }
        //now param_names is good
        let on_first = true
        let src_before_undefined = result
        for(let param_name of param_names){
            let id = this.arg_name_to_dom_elt_id(param_name)
            let elt = window[id]
            let val = elt.value.trim()
            if(val === "") { val = "undefined" }
            if (!on_first) { result += ", " }
            if (mt_separate_xyzs && (param_name == "x")) {
               if(fn_is_keyword) { result += "xyz:[" + val }
               else              { result += "[" + val }
            }
            else if(mt_separate_xyzs && (param_name == "y")) { result +=           val }
            else if(mt_separate_xyzs && (param_name == "z")) { result +=           val + "]"}
            else if (fn_is_keyword)                          { result += param_name + ":" + val }
            else                                             { result += val }
            if(val !== "undefined") { src_before_undefined = result } //don't include in src trailing undefineds
            on_first = false
        }
        if(this.dialog_contains_move_all_joints_with_joints()) {
            src_before_undefined += "]"
        }
        if(fn_is_keyword) { src_before_undefined += "}" }
        result = src_before_undefined + ")"
        return result
    }*/

    //if eval_args is true, test the instruction name and arg src.
    //by evaling it. If it errors, print a good error message,
    //highlight the approirate field in the dialog,
    //and return null, otherwise return a string.
    static dialog_to_instruction_src(eval_args=false){
        let result = ""
        let instruction_name = mi_instruction_name_id.value
        let fn = value_of_path(instruction_name)
        if(eval_args){
            if(fn === undefined) {
                this.set_border_color_of_arg("instruction_name", "red")
                out("<span style='color:red'>Error: </span>" +
                    "The instruction name: <code>" + instruction_name + "</code> can't be evaluated.<br/>" +
                    "Correct errors and try again.")
                return null
            }
            else if (typeof(fn) != "function"){
                this.set_border_color_of_arg("instruction_name", "red")
                out("<span style='color:red'>Error: </span>" +
                    "The instruction name: <code>instruction_name</code> is not a function.<br/>" +
                    "Correct errors and try again.")
                return null
            }
            else { this.set_border_color_of_arg("instruction_name") } //everything ok, undo any possible red
        }
        result += instruction_name + "("

        let arg_name_val_src_pairs = function_param_names_and_defaults_array(fn, true)
        let param_names = []
        for(let pair of arg_name_val_src_pairs) { param_names.push(pair[0]) }
        let fn_is_keyword = fn_is_keyword_fn(fn)
        if(fn_is_keyword) { result += "{" }
        let mt_separate_xyzs = this.dialog_contains_move_to_with_separate_xyzs()
        if(this.dialog_contains_move_all_joints_with_joints()){
            result += "["
            param_names = ["joint1", "joint2", "joint3","joint4","joint5","joint6","joint7"]
        }
        else if (mt_separate_xyzs){
            if(param_names[0] == "xyz") { param_names.shift() }
            else { shouldnt("no first 'xyz' param in dialog_to_instruction_src with instruction: " + instruction_name +
                " and param_names: " + param_names) }
            param_names.unshift("z")
            param_names.unshift("y")
            param_names.unshift("x")

        }
        if(starts_with_one_of(instruction_name, ["Dexter.", "Serial."]) && (last(param_names) == "robot")) {
            param_names.pop() //user should be using robot instance as subject, not as last arg
            //else { shouldnt("no last 'robot' param_name in dialog_to_instruction_src with instruction: " + instruction_name +
            //                " and param_names: " + param_names)  }
        }
        //now param_names is good
        let on_first = true
        let src_before_undefined = result
        for(let param_name of param_names){
            let id = this.arg_name_to_dom_elt_id(param_name)
            let elt = window[id]
            let arg_val_src = elt.value.trim()
            if(eval_args){
                try{
                    window.eval(arg_val_src)
                    this.set_border_color_of_arg(param_name)
                }
                catch(err){
                    this.set_border_color_of_arg(param_name, "red")
                    out("<span style='color:red'>Error: </span>" +
                        "In <i>Make Instruction</i>, evaling the <b>" + param_name + "</b> source of:<br/>" +
                        "<code style='padding:3px;'>" + arg_val_src + "</code><br/>errored because:" +
                        "<span style='color:red;'> " + err.message +
                        "</span><br/>Correct errors and try again.")
                    return null
                }
            }
            if(arg_val_src === "") { arg_val_src = "undefined" }
            if (!on_first) { result += ", " }
            if (mt_separate_xyzs && (param_name == "x")) {
                if(fn_is_keyword) { result += "xyz:[" + arg_val_src }
                else              { result += "[" + arg_val_src }
            }
            else if(mt_separate_xyzs && (param_name == "y")) { result +=           arg_val_src }
            else if(mt_separate_xyzs && (param_name == "z")) { result +=           arg_val_src + "]"}
            else if (fn_is_keyword)                          { result += param_name + ":" + arg_val_src }
            else                                             { result += arg_val_src }
            if(arg_val_src !== "undefined") { src_before_undefined = result } //don't include in src trailing undefineds
            on_first = false
        }
        if(this.dialog_contains_move_all_joints_with_joints()) {
            src_before_undefined += "]"
        }
        if(fn_is_keyword) { src_before_undefined += "}" }
        result = src_before_undefined + ")"
        return result
    }

    static run(){
        let inst_src = this.dialog_to_instruction_src()
        let the_inst = eval(inst_src)
        const job_00 = new Job({name: "job_00",
            robot: Robot[mi_robot_name_id.value],
            do_list: [the_inst],
            when_stopped: function(){
                             setTimeout(function() { MakeInstruction.show(inst_src) },
                                        2000)
                          }
        })
        misc_pane_menu_changed("Simulate Dexter")
        //to give user time to adjust to the sim pane
        setTimeout(function() { MakeInstruction.run_after_delay(job_00) },
                   2000)
    }
    static run_after_delay(the_job){
        the_job.start()
    }

    static insert_instruction(){
        let src = this.dialog_to_instruction_src()
        let suffix = ""
        if(Editor.is_selection()) { Editor.replace_selection(src)} //trailing comma ok inside of an array
        else {
            let suffix = ",\n    "
            Editor.insert(src + suffix)
        }
    }
    static insert_job(){
        let src = this.dialog_to_instruction_src()
        let robot_name = mi_robot_name_id.value
        let robot_line = ""
        if(robot_name != "dexter0"){
            robot_line = '         robot: Robot.' + mi_robot_name_id.value + ',\n'
        }
        src = '\nnew Job({name: "my_job",\n' +
        '         do_list: [' + src +
        robot_line +
        '\n                  ]})\n'
        Editor.insert(src)
    }

    static eval_instruction(){
        let src = this.dialog_to_instruction_src(true)
        if(src !== null) {
            eval_js_part2(src)
        }
    }
} //end class


MakeInstruction.menu_hierarchy = [
    ["Dexter move",  "move_all_joints", "move_all_joints_relative",
                     "move_home",
                     "move_to", "move_to_relative", "move_to_straight",
                     "pid_move_all_joints", "pid_move_to"],
    ["Dexter mode",  "set_follow_me", "set_force_protect", "set_keep_position", "set_open_loop"],
    ["Dexter common", "draw_dxf", "empty_instruction_queue_immediately", "empty_instruction_queue",
                      "get_robot_status", "get_robot_status_immediately", "make_ins", "read_from_robot",
                      "run_gcode", "set_parameter", "write_to_robot"],
    ["Dexter rare", "capture_ad", "capture_points", "cause_error", "dma_read", "dma_write", "exit",
                    "find_home", "find_home_rep", "find_index", "load_tables",
                    "record_movement", "replay_movement",
                    "sleep",  "slow_move", "write"],
    ["Human",       "enter_choice", "enter_filepath", "enter_instruction", "enter_number",
                    "enter_position", "enter_text", "notify", "show_window", "speak", "task"],
    ["Robot control", "break", "go_to", "loop","label",
                      "suspend", "unsuspend", "sync_point", "wait_until"],
    ["Robot I/O",  "get_page", "grab_robot_status",  "out",
                   "show_picture", "show_video", "take_picture"],
    ["Robot Jobs", "send_to_job", /*"sent_from_job" don't let user use this*/
                   "start_job", "stop_job"],
    ["Robot bugs", "debugger", "error", "if_any_errors"],
    /*["Robot misc", "define function", "define generator", "null",
                   "new Job", "new Note", "new Phrase", "new TestSuite",
                   "new Dexter", "new Serial"
                   ], */
    ["Serial",     "string_instruction"]
]

var esprima = require('esprima')
var {ends_with_one_of, fn_is_keyword_fn} = require("./core/utils.js")