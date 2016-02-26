(function() {
    'use strict';
    
    angular
        .module('app.tracker')
        .controller('TrackerController', TrackerController);

    TrackerController.$inject = ['$q', '$http', '$sce', '$timeout', 'sseService', '$scope'];
    
    function TrackerController($q, $http, $sce, $timeout, sseService, $scope) {
        var vm = this;

        vm.loading = true;
        vm.reindexing = false;
        vm.page = 1;
        vm.size = 20;
        vm.tableDiffs = [];
        vm.error = false;
        vm.errorDescription = false;
        vm.progressValue = 0;
        vm.source = null;

        vm.trustHtml = trustHtml;
        vm.setStatus = setStatus;
        vm.reload = reload;
        vm.reindex = reindex;

        activate();

        function activate() {
            var promises = [loadTableDiffs()];
            return $q.all(promises).then(function() {
                vm.loading = false;
            });
        }

        function trustHtml(text) {
            return typeof text !== 'undefined' ? $sce.trustAsHtml(text) : '';
        }

        function loadTableDiffs() {
            return $http({
                url: 'load_table_diff.php',
                method: 'POST',
                data: {
                    page: vm.page,
                    size: vm.size
                }
            })
                .then(success)
                .catch(failed);

            function success(response) {
                vm.tableDiffs = response.data;

                return vm.tableDiffs;
            }

            function failed(e) {
                console.log(e);
                vm.error = true;
                vm.errorDescription = e;
            }
        }

        function setStatus(diff, status) {
            if (status === 'skip') {
                vm.tableDiffs.splice(vm.tableDiffs.indexOf(diff), 1);

                return;
            }
            return $http({
                url: 'save_tracker.php',
                method: 'POST',
                data: {
                    id: diff.id,
                    status: status,
                    hash: diff.trackerData.hash
                }
            })
                .then(success)
                .catch(failed);

            function success(response) {
                vm.tableDiffs.splice(vm.tableDiffs.indexOf(diff), 1);
                diff.trackerData.status = status;

                return diff;
            }

            function failed(e) {
                console.log(e);
                vm.error = true;
                vm.errorDescription = e;
            }
        }

        function reload() {
            vm.loading = true;
            vm.tableDiffs = [];
            return loadTableDiffs().then(function() { vm.loading = false; });
        }

        function reindex() {
            vm.reindexing = true;
            vm.tableDiffs = [];
            vm.progressValue = 0;

            return sseService.create('reindex_tracker_data.php', onMessage, onFinish, onError);

            function onMessage(e, response, source) {
                $scope.$apply(function() {
                    if (response.data === 'done') {
                        vm.reindexing = false;
                        source.close();
                    } else {
                        vm.progressValue = parseInt(response.data);
                    }
                });
                console.log(vm.progressValue);

                return vm.progressValue;
            }

            function onFinish(e, response, source) {
                console.log(response);
                $scope.$apply(function() {
                    vm.reindexing = false;
                });
                source.close();
                return reload();
            }

            function onError(e, response, source) {
                console.log(response);
                $scope.$apply(function() {
                    vm.reindexing = false;
                    vm.error = true;
                    vm.errorDescription = response;
                    source.close();
                });
            }
        }
    }
})();
