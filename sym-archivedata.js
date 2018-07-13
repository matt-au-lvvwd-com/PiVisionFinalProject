(function (PV) {
    "use strict";

    function symbolVis() { };
    PV.deriveVisualizationFromBase(symbolVis);

    var definition = { 
	      typeName:           "archivedata",
	      visObjectType:      symbolVis,
	      datasourceBehavior: PV.Extensibility.Enums.DatasourceBehaviors.Multiple,
	      iconUrl:            'Images/chrome.table.white.svg',
	      getDefaultConfig: function(){ 
	          return { 
		            DataShape:       'TimeSeries',
		            DataQueryMode:   window.PIVisualization.Extensibility.Enums.DataQueryMode.ModeSingleton,
		            Intervals:       31,
		            Height:          150,
		            Width:           150,
		            BackgroundColor: '#cdd0db',
		            BorderRadius:    5,
		            DisplayDigits:   2,
		            DateFormat:      "M/d/yyyy",
		            TimeInterval:    "Daily" // this is tied to a <select> at the top of the data table
                                         // the user can choose "Daily", "Monthly" or "Yearly".
                                         // which renders summary data with a summaryDuration of "1h","1d","1mo"
	          } 
	      },
	      configOptions: function() {
	          return [
	              {
		                title: "Format Symbol",
		                mode:  "format"
		            }
	          ];
	      }
    };

    symbolVis.prototype.init = function(scope, elem) {
	      this.onDataUpdate = dataUpdate;

	      function dataUpdate(newData) {
            var i,j,t;
	          var path        = newData.Data[0].Path;
	          var dsAttrWebId;
            var data;

            // getDaily gets summary data for the Path
            // (uses PIWebAPI to get the webId then gets summary data (total, for now)
            function getDaily(path,summaryType,startTime) {
                var summaryDuration = "1h",
                    endTime         = new Date(startTime.getTime() + 86400 * 1000), // add a day to startTime
                    dsWebId         = makeDsAttributeWebId(path);
                    
                    $.when(dsWebId.read())
                    .then(function() {
                        var webId  = dsWebId.at(0).get("WebId");
                        var dsData = makeDsStreamsSummary(webId,summaryType,summaryDuration,startTime,endTime);
                        $.when(dsData.read())
                            .then(function() {
                                scope.DataItems = [];
                                
                                console.log("yay! got data",dsData.at(0).get("Items"));
                                $.each(dsData.at(0).get("Items"),function(index,row){
                                    if (typeof(row.Type) === "undefined")
                                        scope.DataItems.push(row);
                                    else
                                        scope.DataItems.push(row.Value);
                                });
                            })
                            .fail(function() {
                                // yeah, need better error handling, but for now...
                                //throw new Exceeption("unable to get summary data for " + path);
                            });
                    })
                    .fail(function() {
                        // yeah, need better error handling, but for now...
                        //throw new Exception("unable to get webid for " + path);
                    });

                // got a problem with async stuff here. This will return
                // immediately, but the deferred's above will take their time.
                // scope.DataItems will eventually get completed, but the user
                // won't see real data on the first round (immediately).
                // Real data will eventually get into scope.DataItems and get
                // back to the angular side (5-15 seconds or so).
            }

            // getMonthly would be similar to getDaily, though
            // after refactoring getDaily and cleaning up how we work with
            // the datasources and possibly do a better
            function getMonthly(path) {
                return mockMonthlyData();
            }
            
            // getYearly would be similar to getDaily, though
            // after refactoring getDaily and cleaning up how we work with
            // the datasources and possibly do a better
            function getYearly(path) {
                return mockYearlyData();
            }

	          if (!newData) return;

	          var firstAttribute = newData.Data[0];

            console.log("firstAttribute",firstAttribute);

            // these if-elses is a switch yard for TimeInterval
            //   Daily   - get summary data for summaryDuration of 1h
            //             also set DateFormat to "HH:mm"
            //   Monthly - get summary for summaryDuration of 1d
            //             also set DateFormat to "MM/dd"
            //   Yearly  - get summary for summaryDuration of 1mo
            //             also set DateFormat to "MM/dd/yy"
            //             BTW our dev PI server only has 90 days of data,
            //             so most of the year is expected to be blank.
            if (scope.config.TimeInterval == "Daily") {
                var startTime = new Date(2018,5,1,0,0,0);
                scope.config.DateFormat = "HH:mm";
                getDaily(path,"total",new Date(firstAttribute.StartTime));
            }
            else if (scope.config.TimeInterval == "Monthly") {
                scope.config.DateFormat = "MM/dd";
                data = getMonthly(path);

                // for now, just need to cleanup the mock data into
                // a form that will display.
                scope.DataItems = [];
                $.each(data.Items,function(index,row){
                    if (typeof(row.Type) === "undefined")
                        scope.DataItems.push(row);
                    else
                        scope.DataItems.push(row.Value);
                });
                console.log("getMonthly",scope.DataItems);
            }
            else if (scope.config.TimeInterval == "Yearly") {
                scope.config.DateFormat = "MM/dd/yy";
                data = getYearly(path);
                
                // for now, just need to cleanup the mock data into
                // a form that will display.
                scope.DataItems = [];
                $.each(data.Items,function(index,row){
                    if (typeof(row.Type) === "undefined")
                        scope.DataItems.push(row);
                    else
                        scope.DataItems.push(row.Value);
                });
            }

            console.log("DataItems",scope.DataItems);
	          if (firstAttribute.Label) {
		            // sporadic
		            scope.Labels = [];
		            scope.Units = [];
		            for (i=0; i < newData.Data.length; i++) {
		                scope.Labels.push(newData.Data[i].Label);
		                scope.Units.push(newData.Data[i].Units);
		            }
		            console.log("scope.Labels ",scope.Labels);
		            console.log("scope.Units ",scope.Units);
	          }
	      }

        // Create a Kendo DataSource to get the WebId using PIWebAPI
	      function makeDsAttributeWebId(path) {
	          var ds = new kendo.data.DataSource({
		            transport: {
			              read: {
			                  url:      "/piwebapi/attributes?path=" + path,
			                  type:     "GET",
			                  dataType: "json"
			              }
		            },
                schema: {
                    parse: function(response) {
                        var tmp,obj,ary = [];

                        // this fun little kludge works around kendo tossing when it tries to
                        // slice an object that's not an array.
                        tmp = (typeof (response) === "string") ? response : JSON.stringify(response);
                        obj = JSON.parse(tmp);
                        ary.push(obj);

                        return(ary);
                    }
                }
		        });

	          return ds;
	      }

        // Create a Kendo DataSource to get data from 
	      function makeDsStreamsSummary(webId,summaryType,summaryDuration,startTime,endTime) {
	          var ds = new kendo.data.DataSource({
		            transport: {
			              read: {
			                  url:"/piwebapi/streams/" + webId +
                            "/summary"          +
                            "?summarytype="     + summaryType +
                            "&summaryduration=" + summaryDuration +
                            "&starttime="       + kendo.toString(startTime,"MM/dd/yyyy HH:mm") +
                            "&endtime="         + kendo.toString(endTime,  "MM/dd/yyyy HH:mm") ,
			                  type:     "GET",
			                  dataType: "json"
			              }
		            },
                schema: {
                    parse: function(response) {
                        var tmp,obj,ary = [];

                        // this fun little kludge works around kendo tossing when it tries to
                        // slice an object that's not an array.
                        tmp = (typeof (response) === "string") ? response : JSON.stringify(response);
                        obj = JSON.parse(tmp);
                        ary.push(obj);

                        return(ary);
                    }
                }
		        });

	          return ds;
	      }
    };

    // The kruft below is my original mock data.
    // Caution. interpoloated and summary have different structures!
    function mockDailyDataInterp() {
        //\\\piafdev\\AF_Quart\\SNWS\\Assets\\Sites\\Pump Site 1A\\Pump Station Station 1A\\Pump Station Flow\\KepFr Flow|Flow|Day|FrSourceValue
        //https://sstdev.ntlan.lvvwd.com/piwebapi/streams/F1AbEGwieC5I8EUu7QwbNMtR3TAmJgpL41i6BG_WtjLitkjUgP6_tnSw8YF8sxIPPH_AAvwUElBRkRFVlxBRl9RVUFSVFxTTldTXEFTU0VUU1xTSVRFU1xQVU1QIFNJVEUgMUFcUFVNUCBTVEFUSU9OIFNUQVRJT04gMUFcUFVNUCBTVEFUSU9OIEZMT1dcS0VQRlIgRkxPV3xGTE9XfERBWXxGUlNPVVJDRVZBTFVF/interpolated?starttime=6/1/2018&endtime=6/2/2018&interval=1h
        var d = {
            "Links": {},
            "Items": [
                {
                    "Timestamp": "2018-06-01T07:00:00Z",
                    "Value": 2.734375,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-01T08:00:00Z",
                    "Value": 4.93164063,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-01T09:00:00Z",
                    "Value": 11.6210938,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-01T10:00:00Z",
                    "Value": 10.5957031,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-01T11:00:00Z",
                    "Value": 8.837891,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-01T12:00:00Z",
                    "Value": 8.7890625,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-01T13:00:00Z",
                    "Value": 11.7675781,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-01T14:00:00Z",
                    "Value": 8.886719,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-01T15:00:00Z",
                    "Value": 3.36914063,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-01T16:00:00Z",
                    "Value": 3.36914063,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-01T17:00:00Z",
                    "Value": 3.125,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-01T18:00:00Z",
                    "Value": 3.125,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-01T19:00:00Z",
                    "Value": 3.125,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-01T20:00:00Z",
                    "Value": 3.125,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-01T21:00:00Z",
                    "Value": 3.125,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-01T22:00:00Z",
                    "Value": 6.49414063,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-01T23:00:00Z",
                    "Value": 6.4453125,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-02T00:00:00Z",
                    "Value": 11.71875,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-02T01:00:00Z",
                    "Value": 8.935547,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-02T02:00:00Z",
                    "Value": 9.033203,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-02T03:00:00Z",
                    "Value": 9.082031,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-02T04:00:00Z",
                    "Value": 7.2265625,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-02T05:00:00Z",
                    "Value": 6.25,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-02T06:00:00Z",
                    "Value": 3.41796875,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                },
                {
                    "Timestamp": "2018-06-02T07:00:00Z",
                    "Value": 3.17382813,
                    "UnitsAbbreviation": "US kgal/min",
                    "Good": true,
                    "Questionable": false,
                    "Substituted": false
                }
            ],
            "UnitsAbbreviation": "US kgal/min"
        };

        return d;
    }
    
    function mockDailyData() {
        //\\\\piafdev\\AF_Quart\\SNWS\\Assets\\Sites\\Pump Site 1A\\Pump Station Station 1A\\Pump Station Flow\\KepFr Flow|Flow|Day|FrSourceValue
        //https://sstdev.ntlan.lvvwd.com/piwebapi/streams/F1AbEGwieC5I8EUu7QwbNMtR3TAmJgpL41i6BG_WtjLitkjUgJZI1EKm3nlguCgh5lMuHMQUElBRkRFVlxBRl9RVUFSVFxTTldTXEFTU0VUU1xTSVRFU1xQVU1QIFNJVEUgMUFcUFVNUCBTVEFUSU9OIFNUQVRJT04gMUFcUFVNUCBTVEFUSU9OIEZMT1dcS0VQRlIgRkxPV3xGTE9XfERBWQ/summary?summarytype=total&starttime=6/1/2018&endtime=6/2/2018&summaryduration=1h
        var d = {
            "Links": {},
            "Items": [
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-01T07:00:00Z",
                        "Value": 0.12953016493055555,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-01T08:00:00Z",
                        "Value": 0.29364691840277779,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-01T09:00:00Z",
                        "Value": 0.47980414496527779,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-01T10:00:00Z",
                        "Value": 0.37367078993055558,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-01T11:00:00Z",
                        "Value": 0.37027994791666669,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-01T12:00:00Z",
                        "Value": 0.3811306423611111,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-01T13:00:00Z",
                        "Value": 0.4626803927951389,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-01T14:00:00Z",
                        "Value": 0.2643161349826389,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-01T15:00:00Z",
                        "Value": 0.14122856987847221,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-01T16:00:00Z",
                        "Value": 0.0873141818576389,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-01T17:00:00Z",
                        "Value": 0.13020833333333334,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-01T18:00:00Z",
                        "Value": 0.12986924913194445,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-01T19:00:00Z",
                        "Value": 0.12969970703125,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-01T20:00:00Z",
                        "Value": 0.12969970703125,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-01T21:00:00Z",
                        "Value": 0.1483493381076389,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-01T22:00:00Z",
                        "Value": 0.26804606119791669,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-01T23:00:00Z",
                        "Value": 0.34417046440972221,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-02T00:00:00Z",
                        "Value": 0.42809380425347221,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-02T01:00:00Z",
                        "Value": 0.37400987413194442,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-02T02:00:00Z",
                        "Value": 0.37790934244791669,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-02T03:00:00Z",
                        "Value": 0.37892659505208331,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-02T04:00:00Z",
                        "Value": 0.26228162977430558,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-02T05:00:00Z",
                        "Value": 0.24329291449652779,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-02T06:00:00Z",
                        "Value": 0.086805555555555552,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                }
            ]
        };

        return d;
    };


    function mockMonthlyData() {
        //\\\\piafdev\\AF_Quart\\SNWS\\Assets\\Sites\\Pump Site 1A\\Pump Station Station 1A\\Pump Station Flow\\KepFr Flow|Flow|Day
        //https://sstdev.ntlan.lvvwd.com/piwebapi/streams/F1AbEGwieC5I8EUu7QwbNMtR3TAmJgpL41i6BG_WtjLitkjUgJZI1EKm3nlguCgh5lMuHMQUElBRkRFVlxBRl9RVUFSVFxTTldTXEFTU0VUU1xTSVRFU1xQVU1QIFNJVEUgMUFcUFVNUCBTVEFUSU9OIFNUQVRJT04gMUFcUFVNUCBTVEFUSU9OIEZMT1dcS0VQRlIgRkxPV3xGTE9XfERBWQ/summary?summarytype=total&starttime=6/1/2018&endtime=7/1/2018&summaryduration=1d
        var d = {
            "Links": {},
            "Items": [
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-01T07:00:00Z",
                        "Value": 9.2706400553385411,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-02T07:00:00Z",
                        "Value": 10.846481323242188,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-03T07:00:00Z",
                        "Value": 11.8125,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-04T07:00:00Z",
                        "Value": 11.8125,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-05T07:00:00Z",
                        "Value": 11.774327596028646,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-06T07:00:00Z",
                        "Value": 9.9780426025390625,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-07T07:00:00Z",
                        "Value": 9.8590189615885411,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-08T07:00:00Z",
                        "Value": 9.0854949951171875,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-09T07:00:00Z",
                        "Value": 9.0673777262369786,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-10T07:00:00Z",
                        "Value": 7.076853434244792,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-11T07:00:00Z",
                        "Value": 9.008941650390625,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-12T07:00:00Z",
                        "Value": 9.8613993326822911,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-13T07:00:00Z",
                        "Value": 9.6914723714192714,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-14T07:00:00Z",
                        "Value": 10.167592366536459,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-15T07:00:00Z",
                        "Value": 9.7376759847005214,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-16T07:00:00Z",
                        "Value": 9.2243245442708339,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-17T07:00:00Z",
                        "Value": 8.5492604573567714,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-18T07:00:00Z",
                        "Value": 8.7465006510416661,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-19T07:00:00Z",
                        "Value": 9.5330810546875,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-20T07:00:00Z",
                        "Value": 10.527750651041666,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-21T07:00:00Z",
                        "Value": 9.5592142740885411,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-22T07:00:00Z",
                        "Value": 10.043807983398437,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-23T07:00:00Z",
                        "Value": 9.3271230061848964,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-24T07:00:00Z",
                        "Value": 8.8553009033203125,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-25T07:00:00Z",
                        "Value": 9.4101969401041661,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-26T07:00:00Z",
                        "Value": 10.508433024088541,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-27T07:00:00Z",
                        "Value": 10.244873046875,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-28T07:00:00Z",
                        "Value": 9.447021484375,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-29T07:00:00Z",
                        "Value": 10.226877848307291,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-30T07:00:00Z",
                        "Value": 9.6524709065755214,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                }
            ]
        };

        return d;
    };

    function mockYearlyData()
    {
        //https://sstdev.ntlan.lvvwd.com/piwebapi/streams/F1AbEGwieC5I8EUu7QwbNMtR3TAmJgpL41i6BG_WtjLitkjUgJZI1EKm3nlguCgh5lMuHMQUElBRkRFVlxBRl9RVUFSVFxTTldTXEFTU0VUU1xTSVRFU1xQVU1QIFNJVEUgMUFcUFVNUCBTVEFUSU9OIFNUQVRJT04gMUFcUFVNUCBTVEFUSU9OIEZMT1dcS0VQRlIgRkxPV3xGTE9XfERBWQ/summary?summarytype=total&starttime=1/1/2018&endtime=1/1/2019&summaryduration=1mo
        var d = {
            "Links": {},
            "Items": [
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-01-01T08:00:00Z",
                        "Value": null,
                        "UnitsAbbreviation": "",
                        "Good": false,
                        "Questionable": false,
                        "Substituted": false,
                        "Errors": [
                            {
                                "FieldName": "Value",
                                "Message": [
                                    "[-11059] No Good Data For Calculation"
                                ]
                            }
                        ]
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-02-01T08:00:00Z",
                        "Value": null,
                        "UnitsAbbreviation": "",
                        "Good": false,
                        "Questionable": false,
                        "Substituted": false,
                        "Errors": [
                            {
                                "FieldName": "Value",
                                "Message": [
                                    "[-11059] No Good Data For Calculation"
                                ]
                            }
                        ]
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-03-01T08:00:00Z",
                        "Value": 177.58516920658582,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-04-01T07:00:00Z",
                        "Value": 201.84098307291666,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-05-01T07:00:00Z",
                        "Value": 233.367919921875,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-06-01T07:00:00Z",
                        "Value": 292.90655517578125,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-07-01T07:00:00Z",
                        "Value": 284.25446806126524,
                        "UnitsAbbreviation": "",
                        "Good": true,
                        "Questionable": false,
                        "Substituted": false
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-08-01T07:00:00Z",
                        "Value": null,
                        "UnitsAbbreviation": "",
                        "Good": false,
                        "Questionable": false,
                        "Substituted": false,
                        "Errors": [
                            {
                                "FieldName": "Value",
                                "Message": [
                                    "[-11059] No Good Data For Calculation"
                                ]
                            }
                        ]
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-09-01T07:00:00Z",
                        "Value": null,
                        "UnitsAbbreviation": "",
                        "Good": false,
                        "Questionable": false,
                        "Substituted": false,
                        "Errors": [
                            {
                                "FieldName": "Value",
                                "Message": [
                                    "[-11059] No Good Data For Calculation"
                                ]
                            }
                        ]
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-10-01T07:00:00Z",
                        "Value": null,
                        "UnitsAbbreviation": "",
                        "Good": false,
                        "Questionable": false,
                        "Substituted": false,
                        "Errors": [
                            {
                                "FieldName": "Value",
                                "Message": [
                                    "[-11059] No Good Data For Calculation"
                                ]
                            }
                        ]
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-11-01T07:00:00Z",
                        "Value": null,
                        "UnitsAbbreviation": "",
                        "Good": false,
                        "Questionable": false,
                        "Substituted": false,
                        "Errors": [
                            {
                                "FieldName": "Value",
                                "Message": [
                                    "[-11059] No Good Data For Calculation"
                                ]
                            }
                        ]
                    }
                },
                {
                    "Type": "Total",
                    "Value": {
                        "Timestamp": "2018-12-01T08:00:00Z",
                        "Value": null,
                        "UnitsAbbreviation": "",
                        "Good": false,
                        "Questionable": false,
                        "Substituted": false,
                        "Errors": [
                            {
                                "FieldName": "Value",
                                "Message": [
                                    "[-11059] No Good Data For Calculation"
                                ]
                            }
                        ]
                    }
                }
            ]
        };
        return d;
    };

    PV.symbolCatalog.register(definition); 
})(window.PIVisualization); 
