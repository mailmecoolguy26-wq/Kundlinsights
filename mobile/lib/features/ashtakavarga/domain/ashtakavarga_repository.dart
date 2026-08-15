import 'ashtakavarga.dart';

abstract interface class AshtakavargaRepository {
  Future<Ashtakavarga> getAshtakavarga({required String birthProfileId});
}
