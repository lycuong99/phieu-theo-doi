# Các phiếu trong một đợt điều trị

`Data` phiên bản 2 giữ `patient` chung cho toàn đợt và ba nhánh `forms.treatment`, `forms.infusion`, `forms.care`. Thay đổi thông tin người bệnh áp dụng cho mọi ngày và mọi bản in của đợt.

## Thêm một loại phiếu

1. Khai báo kiểu dữ liệu, giá trị trống và kiểm tra hợp lệ trong `model.ts`.
2. Tạo module nhập nhận `data`, `onChange`, `patient`, `canPrint`. Dùng cập nhật hàm để giữ nội dung mới nhất của các phiếu khác.
3. Tạo hàm xuất HTML độc lập; escape mọi nội dung người dùng. Quy tắc ngày, buổi, chia trang thuộc riêng từng loại.
4. Đăng ký nhãn và lựa chọn ở `shared.tsx`, nối module vào màn hình đợt trong `App.tsx`.
5. Cập nhật validator Convex, chuyển định dạng dữ liệu và test lưu/đọc lại.

Module phiếu không truy cập Convex hoặc localStorage. Lưu, tự lưu, bản nháp và xử lý xung đột đi qua module `services/treatment-records` hiện có. Thư viện nội dung hiện tại dành cho phiếu điều trị.

## Dữ liệu cũ

- `parseData` đọc JSON v1; `readRecord` chuyển bản ghi lưu trữ cũ thành cấu trúc v2 tại adapter. Việc đọc không ghi lại dữ liệu.
- Các thông tin người bệnh cũ được giữ trong `patientReview.base/byDay`. Khi khác nhau, người dùng phải chọn bộ dùng chung trước khi chỉnh thông tin chung và in.
- Lần ghi đầu tiên vào localStorage giữ nguyên chuỗi dữ liệu trước chuyển đổi trong `treatment-services-before-v2`. Khóa `treatment-quick-entry-v1` không bị xóa.
- Convex chấp nhận schema cũ và mới. Lần lưu v2 thay thế bản ghi bằng cấu trúc mới; dữ liệu người bệnh cũ vẫn nằm trong `patientReview`, các dòng điều trị nằm trong `forms.treatment`.
- Sau khi bản ghi có `forms`, backend từ chối thao tác ghi cấu trúc cũ có thể làm mất các phiếu mới. Cần tải lại các tab ứng dụng cũ khi cập nhật frontend.
- Khi triển khai: cập nhật backend tương thích trước, sau đó frontend. Không hạ backend về schema chỉ có `rows` khi đã phát sinh dữ liệu v2.

## Bản in

Phiếu điều trị giữ quy tắc sáng/chiều hiện có. Truyền dịch dùng bảng với đầu cột lặp lại khi qua trang. Chăm sóc chia mỗi nhóm tối đa 4 mốc, có mẫu mặt trước/mặt tiếp theo; ghi nhận dài chuyển sang trang chi tiết với số tham chiếu, không cắt mất nội dung.

Kiểm tra bằng `pnpm test`, `pnpm build`, `pnpm exec tsc -p convex/tsconfig.json --noEmit`. `pnpm test:convex` dùng dữ liệu giả trên dev và tự dọn fixture; cần kết nối deployment dev đã cấu hình.

## Quy ước giá trị chăm sóc

`care-conventions.ts` là nguồn chung cho loại ô nhập, các mã lựa chọn, định dạng giá trị in và bảng quy ước ký hiệu. `CareField` dùng định nghĩa này để hiển thị số đo, huyết áp tâm thu/tâm trương, lựa chọn mã hoặc đa chọn T/CLS/CS/TV. Không gán mặc định cho nội dung chưa ghi nhận.

Giữ kiểu lưu `values` hiện tại để đọc được bản sao cũ: lựa chọn đơn lưu mã (`1`, `+`, `-`), ghi chú theo mã lưu `mã | mô tả`, đa chọn lưu `1, 3`, thao tác CS.14/CS.15 lưu `14+` hoặc `15-`. Khi in, mã kèm mô tả thành `mã / mô tả`, thao tác thành `14(+)`. Giá trị cũ không nhận diện được vẫn được giữ nguyên cho đến khi người dùng chủ động chọn hoặc nhập lại.

Chọn “Khác” thì cần mô tả; chọn CS.14/CS.15 thì cần chọn đặt/rút; huyết áp đã bắt đầu nhập cần đủ hai số trước khi in. Bản nháp chưa hoàn thiện vẫn tự lưu. Không tự tính hoặc tự kết luận điểm NEWS 2, Braden, Morse từ các ô khác.

## React Hook Form

Thông tin người bệnh, cả ba loại phiếu, trang cấu hình mặc định và các ô thêm/sửa nội dung mẫu đã dùng React Hook Form. Hộp tạo ngày mới cũng dùng RHF cho ngày đích. Các điều khiển tìm kiếm, lọc và chọn tab vẫn là trạng thái giao diện.

- `use-synchronized-form.ts` dùng chung cho dữ liệu người bệnh, truyền dịch, nội dung ngày/buổi điều trị và chăm sóc. RHF quản lý giá trị nhập và trạng thái dirty/touched; module chăm sóc tiếp tục dùng `careValueIssue`, các hộp mẫu dùng kiểm tra nội dung không rỗng. Chưa cần thêm resolver/schema library.
- Mỗi thao tác nhập gọi `setValue` và cập nhật đúng đường dẫn trong bản nháp workspace ngay trong cùng sự kiện. Không dùng `watch`/effect để ghi dữ liệu và không tạo thêm timer tự lưu.
- Giá trị trống của các ô ẩn được chuẩn bị bằng `careEditorValues`; `shouldUnregister: false` giữ các mốc chưa hiển thị.
- `formValuesKey` so sánh nội dung không phụ thuộc thứ tự khóa. Phản hồi sau lưu không reset form hoặc con trỏ khi dữ liệu không đổi.
- Khi nội dung workspace thay đổi thực sự (đổi đợt, khôi phục bản sao, nhận bản từ xa hoặc chọn giải quyết xung đột), hook reset từ dữ liệu workspace. Chính workspace quyết định giữ bản nháp hay nhận dữ liệu từ xa; RHF không tự gộp hai bản.
- Danh sách mốc, chẩn đoán, mục tiêu giữ khóa ID nghiệp vụ hiện có. ID được tạo khi người dùng thêm mục, không tạo lại trong quá trình reset.
- RHF có thể trả về `undefined` cho ô chưa nhập trong danh sách mới thêm hoặc đổi vị trí. `updateCareField` loại các giá trị này khỏi dictionary trước khi lưu, không thay chúng bằng kết quả lâm sàng; có test hồi quy cho thao tác xóa mốc đầu.

- Nội dung điều trị có form riêng cho mỗi ngày/buổi, khóa theo ngữ cảnh đó. Chọn nội dung từ thư viện cập nhật cả RHF và các dòng nguồn trong cùng sự kiện; sao chép/xóa ngày tiếp tục dùng logic nghiệp vụ hiện có.
- Các form tạo/sửa mẫu và ngày đích là bản nháp cục bộ, chỉ áp dụng khi xác nhận. Thay đổi dữ liệu phiếu vẫn đi ngay vào workspace để thao tác chuyển đợt buộc lưu được toàn bộ phần vừa nhập.

## Thư viện mẫu chăm sóc

1. Mở “Mẫu chăm sóc” ở thanh bên (`/care-defaults`).
2. Thêm mẫu, đặt tên, điền các giá trị theo quy ước. Chọn “Đặt làm mặc định” nếu muốn chọn sẵn mẫu đó. Bấm “Lưu thư viện” để lưu mọi thay đổi.
3. Khi phiếu chưa có mốc, chọn mẫu hoặc “Để trống”, rồi thêm mốc đầu tiên.
4. Mỗi mốc tiếp theo sao chép giá trị của mốc cuối cùng trong danh sách, kể cả khi đang xem mốc cũ. `nextCareObservation` tạo ID và thời gian mới, sao chép độc lập các giá trị đã chỉnh; không đọc lại mẫu để ghi đè mốc sau.

`CareObservationFields` và `CareConventionControl` dùng chung định nghĩa trường, quy ước và ô nhập giữa mẫu và phiếu. Thông tin người bệnh, dị ứng và chẩn đoán/mục tiêu không nằm trong mẫu.

`CareDefaultsStore` là seam lưu thư viện với hai adapter localStorage/Convex. Interface chỉ gồm đọc, ghi toàn thư viện có kiểm tra revision và theo dõi thay đổi. Thư viện có revision riêng với đợt điều trị; mỗi mẫu có ID, tên, giá trị; `defaultTemplateId` trỏ tới một mẫu hoặc null. Xóa mẫu mặc định sẽ bỏ lựa chọn mặc định, không tự chọn mẫu khác.

Cấu hình đơn cũ được chuyển khi đọc thành “Mẫu mặc định hiện tại” với ID ổn định, giữ revision và các giá trị. Đọc không ghi lại dữ liệu; lần lưu kế tiếp dùng cấu trúc thư viện. Backend chấp nhận dữ liệu lưu cũ nhưng thao tác ghi yêu cầu cấu trúc mới; tải lại các tab cũ sau cập nhật.

Trang chỉ lưu khi xác nhận, giữ bản đang sửa khi chuyển trang và cho chọn xử lý khi có cập nhật từ xa. Sửa/xóa mẫu không thay đổi các mốc đã ghi. Bản sao JSON của đợt chứa giá trị từng mốc, không chứa thư viện mẫu toàn workspace.

## Chỉ định điều trị có cấu trúc

`components/treatment-orders/orders-editor.tsx` là component controlled, nhận
`value`, `onChange`, `drugNames?` và `label?`. Component không truy cập adapter
hoặc DB. `drug-name-input.tsx` dùng shadcn Combobox, cho gõ tự do hoặc chọn tên;
chỉ điền tên, không tự thêm vào thư viện hoặc điền thông tin sử dụng thuốc.
Host có thể truyền thư viện tên vào `TreatmentForm.drugNames`; hiện tại gợi ý
bổ sung từ các thuốc đã nhập trong cùng đợt, không có danh mục mẫu trên sản phẩm.

Type ở `types/treatment-orders.ts`. `TreatmentRow.orders` chấp nhận chuỗi cũ
hoặc `{ version: 1, items: [...] }`; version này độc lập với `Data.version: 2`.
Không chuyển đoán văn bản cũ thành thuốc. Khi sửa, nội dung cũ được giữ trong
một mục văn bản nguyên vẹn. Validator ở frontend và Convex kiểm tra cấu trúc;
version chưa hỗ trợ bị từ chối khi đọc/import, không bỏ nội dung âm thầm.

Các ô của chỉ định cập nhật RHF và workspace ngay trong sự kiện, kể cả bản
nháp chưa đủ thông tin. “Xong” chỉ thu gọn, không phải nút lưu. Tạo/xóa mục,
pha/ghi chú và đổi thứ tự cũng cập nhật ngay. Liều, đơn vị, số lần, đường dùng,
tốc độ và đơn vị tốc độ ban đầu trống; không suy ra từ tên hoặc lịch dùng.

`lib/treatment-orders.ts` giữ factories, validation, chuyển sang văn bản và
nối các dòng cũ/mới. In dùng `ordersText`, bao gồm `sequence` thủ công nếu có.
Mẫu chỉ định lưu tên, nhóm bệnh và cấu trúc `TreatmentOrdersV1`; khi áp dụng
thêm vào cuối, cấp ID mới cho dòng/quan hệ và bỏ số thứ tự. Mẫu văn bản cũ
được giữ nguyên thành mục văn bản, không tự phân tích thuốc. Tách số khỏi tên
chỉ là đề nghị, cần người dùng xác nhận. Sao chép ngày giữ cấu trúc và clone sâu cả hai buổi.
Backend cần triển khai validator tương thích trước frontend. Không cần sửa
nội dung bản ghi cũ hàng loạt. Chưa triển khai thư viện thuốc bền vững hay
quản lý kho; danh sách tên là dependency từ caller.

`demo-orders.html` dùng cùng component với dữ liệu minh họa, giữ riêng state
trong bộ nhớ và không nối services của ứng dụng.

## Trang thư viện mẫu

`TemplateLibraryPage` quản lý tìm/lọc, chọn mẫu, xem trước và bản nháp chỉnh sửa
ở route `/khoa/$workspaceKey/thu-vien-mau`. Module nhận thư viện và callback cập
nhật từ workspace; không tạo storage hoặc gọi Convex riêng. Khi lưu, cập nhật
qua cùng luồng tự lưu/revision của đợt điều trị. Bản nháp chưa lưu chặn chuyển
trang/Khoa và cảnh báo khi tải lại; mẫu bị đổi ở nơi khác không được ghi đè.
`lib/templates.ts` giữ quy tắc tìm không dấu dùng chung với hộp chọn mẫu nhanh.
